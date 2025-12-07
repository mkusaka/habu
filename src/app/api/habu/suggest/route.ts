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

const HATENA_TAGS_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/tags";
const PAGE_META_PROXY_URL = "https://page-meta-proxy.polyfill.workers.dev/meta";
const MAX_MARKDOWN_CHARS = 800000;

interface PageMetaProxyResponse {
  title?: string;
  lang?: string;
  og?: {
    title?: string;
    description?: string;
    type?: string;
    site_name?: string;
  };
  twitter?: {
    title?: string;
    description?: string;
  };
  metaByName?: {
    description?: string;
    keywords?: string;
    author?: string;
  };
}

/**
 * Fetch markdown content from Cloudflare Browser Rendering
 */
async function fetchMarkdown(
  url: string,
  cfAccountId: string,
  cfApiToken: string,
): Promise<{ markdown: string; error?: string }> {
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
      return { markdown: data.result.slice(0, MAX_MARKDOWN_CHARS) };
    }

    console.error("Markdown API returned failure:", data);
    return { markdown: "", error: `API error: ${JSON.stringify(data.errors)}` };
  } catch (error) {
    console.error("Markdown fetch exception:", error);
    return { markdown: "", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Fetch page metadata from page-meta-proxy
 */
async function fetchMetadata(url: string): Promise<PageMetadata> {
  try {
    const response = await fetch(`${PAGE_META_PROXY_URL}?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      return {};
    }

    const meta = (await response.json()) as PageMetaProxyResponse;

    return {
      title: meta?.title || meta?.og?.title || meta?.twitter?.title,
      description:
        meta?.og?.description || meta?.twitter?.description || meta?.metaByName?.description,
      lang: meta?.lang,
      ogType: meta?.og?.type,
      siteName: meta?.og?.site_name,
      keywords: meta?.metaByName?.keywords,
      author: meta?.metaByName?.author,
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
    const { url } = body;

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

    // Fetch markdown, metadata, and existing tags in parallel
    const cfAccountId = env.BROWSER_RENDERING_ACCOUNT_ID ?? "";
    const cfApiToken = env.BROWSER_RENDERING_API_TOKEN ?? "";

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
    const result = await run.start({
      inputData: {
        url,
        existingTags,
      },
      tracingOptions: {
        metadata: {
          userId: session.user.id,
          hatenaId: user.hatenaId,
          url,
        },
      },
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
