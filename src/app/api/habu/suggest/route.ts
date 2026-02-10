import { NextRequest, NextResponse } from "next/server";
import { createSignedRequest } from "@/lib/hatena-oauth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createAuth } from "@/lib/auth";
import type {
  HatenaTagsResponse,
  SuggestRequest,
  SuggestResponse,
  PageMetadata,
} from "@/types/habu";
import { mastra } from "@/mastra";
import { RuntimeContext } from "@mastra/core/di";
import { fetchPageMeta, isMetaExtractionResult } from "@/lib/page-meta";
import { isTwitterStatusUrl } from "@/lib/twitter-oembed";
import { fetchTwitterMarkdown } from "@/lib/twitter-content";
import type { WorkflowStepMeta } from "@/lib/mastra-workflow-progress";

const HATENA_TAGS_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/tags";
const MAX_MARKDOWN_CHARS = 800000;

/**
 * Fetch markdown content from Cloudflare Browser Rendering
 */
async function fetchMarkdown(
  url: string,
  cfAccountId: string,
  cfApiToken: string,
): Promise<{ markdown: string; error?: string }> {
  if (isTwitterStatusUrl(url)) {
    try {
      const twitter = await fetchTwitterMarkdown(url);
      if (twitter?.markdown) {
        return { markdown: twitter.markdown.slice(0, MAX_MARKDOWN_CHARS) };
      }
    } catch {
      // fall through to rendering
    }
  }

  if (!cfAccountId || !cfApiToken) {
    return { markdown: "", error: "Missing CF credentials" };
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/browser-rendering/markdown`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfApiToken}`,
        },
        body: JSON.stringify({ url }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Markdown fetch failed:", response.status, errorText);
      return { markdown: "", error: `HTTP ${response.status}: ${errorText.slice(0, 200)}` };
    }

    const data = (await response.json()) as {
      success: boolean;
      result?: string;
      errors?: unknown[];
    };
    if (data.success && data.result) {
      const markdown = data.result.slice(0, MAX_MARKDOWN_CHARS);

      if (
        isTwitterStatusUrl(url) &&
        (markdown.includes("Something went wrong") ||
          (markdown.includes("Try again") && markdown.includes("x.com")) ||
          markdown.includes("Some privacy related extensions may cause issues on x.com"))
      ) {
        try {
          const twitter = await fetchTwitterMarkdown(url);
          if (twitter?.markdown) {
            return { markdown: twitter.markdown.slice(0, MAX_MARKDOWN_CHARS) };
          }
        } catch {
          // ignore
        }
        return { markdown: "", error: "X returned an interstitial error page" };
      }

      return { markdown };
    }

    console.error("Markdown API returned failure:", data);
    return { markdown: "", error: `API error: ${JSON.stringify(data.errors)}` };
  } catch (error) {
    console.error("Markdown fetch exception:", error);
    return { markdown: "", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Fetch page metadata using local HTMLRewriter implementation
 */
async function fetchMetadata(url: string): Promise<PageMetadata> {
  try {
    const result = await fetchPageMeta(url);

    if (!isMetaExtractionResult(result)) {
      return {};
    }

    return {
      title: result.title || result.og?.title || result.twitter?.title,
      description: result.og?.description || result.twitter?.description || result.description,
      lang: result.lang,
      ogType: result.og?.type,
      siteName: result.og?.site_name,
      keywords: result.keywords,
      author: result.author,
    };
  } catch {
    return {};
  }
}

/**
 * Fetch user's existing tags from Hatena Bookmark API
 */
async function fetchHatenaTags(
  accessToken: string,
  accessTokenSecret: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<string[]> {
  const maxRetries = 3;
  const baseDelay = 500;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const authHeaders = createSignedRequest(
      HATENA_TAGS_API_URL,
      "GET",
      accessToken,
      accessTokenSecret,
      consumerKey,
      consumerSecret,
    );

    try {
      const response = await fetch(HATENA_TAGS_API_URL, {
        method: "GET",
        headers: authHeaders,
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("Location");
        throw new Error(`Hatena Tags API redirect detected: ${response.status} -> ${location}`);
      }

      if (response.ok) {
        const data = (await response.json()) as HatenaTagsResponse;
        return data.tags.map((t) => t.tag);
      }

      const errorText = await response.text();
      const wwwAuth = response.headers.get("WWW-Authenticate");
      const problemMatch = wwwAuth?.match(/oauth_problem="([^"]+)"/);

      if (response.status !== 401 || problemMatch) {
        throw new Error(`Hatena Tags API error: ${response.status} - ${errorText}`);
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw new Error(`Hatena Tags API error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Hatena Tags API error: max retries exceeded");
}

/**
 * Generate AI suggestions without saving to Hatena
 * POST /api/habu/suggest
 */
export async function POST(request: NextRequest) {
  try {
    const accept = request.headers.get("accept") ?? "";
    const streamMode =
      request.nextUrl.searchParams.get("stream") === "1" || accept.includes("text/event-stream");

    // CSRF protection
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const requestUrl = new URL(request.url);
    const expectedOrigin = requestUrl.origin;

    if (origin && origin !== expectedOrigin) {
      return NextResponse.json({ success: false, error: "Invalid origin" } as SuggestResponse, {
        status: 403,
      });
    }

    if (!origin && referer) {
      const refererUrl = new URL(referer);
      if (refererUrl.origin !== expectedOrigin) {
        return NextResponse.json({ success: false, error: "Invalid referer" } as SuggestResponse, {
          status: 403,
        });
      }
    }

    // Get DB connection for auth
    const { env } = getCloudflareContext();
    const auth = createAuth(env.DB);

    // Get current user session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Not authenticated" } as SuggestResponse, {
        status: 401,
      });
    }

    // Get user with hatenaToken relation
    const db = getDb(env.DB);

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      with: { hatenaToken: true },
    });

    if (!user?.hatenaToken) {
      return NextResponse.json(
        { success: false, error: "Hatena not connected" } as SuggestResponse,
        { status: 400 },
      );
    }

    const { accessToken: hatenaAccessToken, accessTokenSecret: hatenaAccessTokenSecret } =
      user.hatenaToken;

    // Get consumer credentials from env
    const consumerKey = env.HATENA_CONSUMER_KEY;
    const consumerSecret = env.HATENA_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" } as SuggestResponse,
        { status: 500 },
      );
    }

    // Parse request body
    const body: SuggestRequest = await request.json();
    const { url, userContext } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: "URL is required" } as SuggestResponse, {
        status: 400,
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid URL format" } as SuggestResponse, {
        status: 400,
      });
    }

    const cfAccountId = env.BROWSER_RENDERING_ACCOUNT_ID ?? "";
    const cfApiToken = env.BROWSER_RENDERING_API_TOKEN ?? "";

    if (streamMode) {
      const encoder = new TextEncoder();

      const grokModel = () => process.env.XAI_MODEL || "grok-4-1-fast-reasoning";

      const computeStepMeta = (args: {
        stepId: string;
        eventType: string;
        payload: unknown;
        url: string;
      }): WorkflowStepMeta | undefined => {
        const { stepId, eventType, payload, url } = args;
        const payloadObj = payload as Record<string, unknown> | undefined;

        if (stepId === "fetch-metadata") return { provider: "Habu", api: "HTMLRewriter (local)" };
        if (stepId === "merge-content" || stepId === "merge-results")
          return { provider: "Habu", api: "merge" };

        if (stepId === "generate-summary")
          return { provider: "OpenAI", model: "gpt-5-mini", api: "generate + judge" };
        if (stepId === "generate-tags")
          return { provider: "OpenAI", model: "gpt-5-mini", api: "generate + judge" };

        if (stepId === "moderate-user-context" && eventType === "step-result") {
          const output = payloadObj?.output as Record<string, unknown> | undefined;
          const didModerate = output?.didModerate === true;
          if (!didModerate) return undefined;
          return { provider: "OpenAI", model: "omni-moderation-latest", api: "moderations" };
        }

        if (stepId === "web-search") {
          if (eventType === "step-result") {
            const output = payloadObj?.output as Record<string, unknown> | undefined;
            const src = output?.webContextSource;
            if (src === "grok")
              return { provider: "xAI", model: grokModel(), api: "chat/completions" };
            if (src === "openai-web_search")
              return { provider: "OpenAI", model: "gpt-5-mini", api: "web_search" };
            return undefined;
          }
          // If we haven't finished yet, avoid showing both possibilities.
          return undefined;
        }

        if (stepId === "fetch-markdown-and-moderate" && eventType === "step-result") {
          const output = payloadObj?.output as Record<string, unknown> | undefined;
          const src = output?.markdownSource;
          const didModerate = output?.didModerate === true;

          if (src === "twitter-grok") {
            return didModerate
              ? {
                  provider: "xAI + OpenAI",
                  model: `${grokModel()} + omni-moderation-latest`,
                  api: "chat/completions + moderations",
                }
              : { provider: "xAI", model: grokModel(), api: "chat/completions" };
          }
          if (src === "twitter-x-api") {
            return didModerate
              ? {
                  provider: "X API + OpenAI",
                  model: "omni-moderation-latest",
                  api: "tweets lookup + moderations",
                }
              : { provider: "X API", api: "tweets lookup" };
          }
          if (src === "twitter-oembed") {
            return didModerate
              ? {
                  provider: "X oEmbed + OpenAI",
                  model: "omni-moderation-latest",
                  api: "oEmbed + moderations",
                }
              : { provider: "X oEmbed", api: "oEmbed" };
          }
          if (src === "cloudflare") {
            return didModerate
              ? {
                  provider: "Cloudflare + OpenAI",
                  model: "omni-moderation-latest",
                  api: "browser-rendering/markdown + moderations",
                }
              : { provider: "Cloudflare", api: "browser-rendering/markdown" };
          }
          if (src === "none") return undefined;

          // If src absent but we can infer Twitter markdown path from URL, still avoid guessing.
          if (isTwitterStatusUrl(url)) return undefined;
          return undefined;
        }

        return undefined;
      };

      const readable = new ReadableStream<Uint8Array>({
        start: async (controller) => {
          const send = (event: string, data: unknown) => {
            controller.enqueue(encoder.encode(`event: ${event}\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          try {
            send("preflight", { stage: "starting" });

            const markdownPromise = fetchMarkdown(url, cfAccountId, cfApiToken)
              .then((res) => {
                send("preflight", {
                  stage: "fetch_markdown_done",
                  ok: true,
                  hasError: !!res.error,
                  markdown: res.markdown,
                  markdownError: res.error,
                });
                return res;
              })
              .catch((error) => {
                const errorMsg = error instanceof Error ? error.message : "Unknown error";
                send("preflight", {
                  stage: "fetch_markdown_done",
                  ok: false,
                  error: errorMsg,
                  markdownError: errorMsg,
                });
                return { markdown: "", error: "Markdown fetch failed" };
              });

            const metadataPromise = fetchMetadata(url)
              .then((res) => {
                send("preflight", {
                  stage: "fetch_metadata_done",
                  ok: true,
                  metadata: res,
                });
                return res;
              })
              .catch((error) => {
                send("preflight", {
                  stage: "fetch_metadata_done",
                  ok: false,
                  error: error instanceof Error ? error.message : "Unknown error",
                });
                return {};
              });

            send("preflight", { stage: "fetch_hatena_tags" });
            const existingTags = await fetchHatenaTags(
              hatenaAccessToken,
              hatenaAccessTokenSecret,
              consumerKey,
              consumerSecret,
            );
            send("preflight", {
              stage: "fetch_hatena_tags_done",
              ok: true,
              count: existingTags.length,
            });

            // Run the bookmark suggestion workflow
            const workflow = mastra.getWorkflow("bookmark-suggestion");
            const run = await workflow.createRunAsync();

            // Create RuntimeContext with metadata for tracing
            const runtimeContext = new RuntimeContext();
            runtimeContext.set("userId", session.user.id);
            runtimeContext.set("hatenaId", user.hatenaId || "");
            runtimeContext.set("url", url);
            runtimeContext.set("gitSha", process.env.NEXT_PUBLIC_GIT_SHA || "");

            send("workflow", { type: "run-created", payload: { runId: run.runId } });

            const { stream, getWorkflowState } = run.streamLegacy({
              inputData: { url, existingTags, userContext },
              runtimeContext,
            });

            const reader = stream.getReader();
            try {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value && typeof value === "object") {
                  const v = value as { type?: string; payload?: unknown };
                  const payload = v.payload as Record<string, unknown> | undefined;
                  const stepId =
                    typeof payload?.id === "string" ? (payload.id as string) : undefined;
                  const meta = stepId
                    ? computeStepMeta({
                        stepId,
                        eventType: v.type ?? "",
                        payload: payload ?? {},
                        url,
                      })
                    : undefined;
                  if (meta && payload) {
                    send("workflow", { ...v, payload: { ...payload, meta } });
                  } else {
                    send("workflow", value);
                  }

                  if (v.type === "step-result" && payload) {
                    const output = payload.output as Record<string, unknown> | undefined;
                    if (stepId === "generate-summary" && output?.summary) {
                      send("preflight", {
                        stage: "generate_summary_done",
                        summary: output.summary,
                      });
                    }
                    if (stepId === "generate-tags" && output?.tags) {
                      send("preflight", {
                        stage: "generate_tags_done",
                        tags: output.tags,
                      });
                    }
                  }
                } else {
                  send("workflow", value);
                }
              }
            } finally {
              reader.releaseLock();
            }

            const workflowState = await getWorkflowState();
            if (workflowState.status !== "success" || !workflowState.result) {
              throw new Error("Workflow failed");
            }

            const { summary, tags, webContext } = workflowState.result as {
              summary: string;
              tags: string[];
              webContext?: string;
            };

            const tagPart = tags.map((t) => `[${t}]`).join("");
            const formattedComment = `${tagPart}${summary}`;

            const markdownResult = await markdownPromise;
            const metadata = await metadataPromise;

            send("result", {
              success: true,
              summary,
              tags,
              formattedComment,
              markdown: markdownResult.markdown,
              markdownError: markdownResult.error,
              metadata,
              webContext,
            } satisfies SuggestResponse);

            send("done", { ok: true });
          } catch (error) {
            console.error("Suggest stream error:", error);
            send("error", {
              message: error instanceof Error ? error.message : "Internal server error",
            });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // Fetch markdown, metadata, and existing tags in parallel (non-stream mode)
    const [markdownResult, metadata, existingTags] = await Promise.all([
      fetchMarkdown(url, cfAccountId, cfApiToken),
      fetchMetadata(url),
      fetchHatenaTags(hatenaAccessToken, hatenaAccessTokenSecret, consumerKey, consumerSecret),
    ]);

    const markdown = markdownResult.markdown;
    const markdownError = markdownResult.error;

    // Run the bookmark suggestion workflow
    const workflow = mastra.getWorkflow("bookmark-suggestion");
    const run = await workflow.createRunAsync();

    // Create RuntimeContext with metadata for tracing
    const runtimeContext = new RuntimeContext();
    runtimeContext.set("userId", session.user.id);
    runtimeContext.set("hatenaId", user.hatenaId || "");
    runtimeContext.set("url", url);
    runtimeContext.set("gitSha", process.env.NEXT_PUBLIC_GIT_SHA || "");

    const result = await run.start({
      inputData: {
        url,
        existingTags,
        userContext,
      },
      runtimeContext,
    });

    if (result.status !== "success" || !result.result) {
      throw new Error("Workflow failed");
    }

    const { summary, tags, webContext } = result.result;

    // Format comment with tags
    const tagPart = tags.map((t: string) => `[${t}]`).join("");
    const formattedComment = `${tagPart}${summary}`;

    return NextResponse.json({
      success: true,
      summary,
      tags,
      formattedComment,
      markdown,
      markdownError,
      metadata,
      webContext,
    } as SuggestResponse);
  } catch (error) {
    console.error("Suggest API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      } as SuggestResponse,
      { status: 500 },
    );
  }
}
