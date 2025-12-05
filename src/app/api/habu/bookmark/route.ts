import { NextRequest, NextResponse } from "next/server";
import { createSignedRequest } from "@/lib/hatena-oauth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db/client";
import { hatenaTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createAuth } from "@/lib/auth";
import type { BookmarkRequest, BookmarkResponse, HatenaTagsResponse } from "@/types/habu";
import { mastra } from "@/mastra";

const HATENA_BOOKMARK_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/bookmark";
const HATENA_TAGS_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/tags";

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
  const baseDelay = 500; // 500ms, 1000ms, 2000ms

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[fetchHatenaTags] Attempt ${attempt}/${maxRetries}`);
    console.log("[fetchHatenaTags] accessToken:", accessToken?.substring(0, 10) + "...");
    console.log("[fetchHatenaTags] consumerKey:", consumerKey?.substring(0, 10) + "...");
    console.log("[fetchHatenaTags] Current time (ISO):", new Date().toISOString());

    // Generate fresh OAuth headers for each attempt (new nonce/timestamp)
    const authHeaders = createSignedRequest(
      HATENA_TAGS_API_URL,
      "GET",
      accessToken,
      accessTokenSecret,
      consumerKey,
      consumerSecret,
    );

    // Extract and log nonce/timestamp from Authorization header
    const authHeader = authHeaders.Authorization || "";
    const nonceMatch = authHeader.match(/oauth_nonce="([^"]+)"/);
    const timestampMatch = authHeader.match(/oauth_timestamp="([^"]+)"/);
    console.log("[fetchHatenaTags] oauth_nonce:", nonceMatch?.[1]);
    console.log("[fetchHatenaTags] oauth_timestamp:", timestampMatch?.[1]);

    try {
      const response = await fetch(HATENA_TAGS_API_URL, {
        method: "GET",
        headers: authHeaders,
        redirect: "error", // Detect silent redirects
      });

      // Log CF-Ray for debugging IP/POP issues
      const cfRay = response.headers.get("cf-ray");
      console.log("[fetchHatenaTags] Response status:", response.status, "cf-ray:", cfRay);

      if (response.ok) {
        const data = (await response.json()) as HatenaTagsResponse;
        console.log("[fetchHatenaTags] Got", data.tags.length, "tags");
        return data.tags.map((t) => t.tag);
      }

      // Handle error
      const errorText = await response.text();
      const wwwAuth = response.headers.get("WWW-Authenticate");
      console.error("[fetchHatenaTags] Error:", response.status, errorText);
      console.error("[fetchHatenaTags] WWW-Authenticate:", wwwAuth);

      const problemMatch = wwwAuth?.match(/oauth_problem="([^"]+)"/);
      if (problemMatch) {
        console.error("[fetchHatenaTags] OAuth Problem:", problemMatch[1]);
      }

      // Don't retry on non-401 errors or if we have a specific oauth_problem
      if (response.status !== 401 || problemMatch) {
        throw new Error(`Hatena Tags API error: ${response.status} - ${errorText}`);
      }

      // 401 without oauth_problem - retry with backoff
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[fetchHatenaTags] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw new Error(`Hatena Tags API error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      // Handle redirect errors
      if (error instanceof TypeError && error.message.includes("redirect")) {
        console.error("[fetchHatenaTags] Redirect detected - Authorization header may be lost");
      }
      if (attempt >= maxRetries) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`[fetchHatenaTags] Error, retrying in ${delay}ms...`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Hatena Tags API error: max retries exceeded");
}

/**
 * Format comment with tags for Hatena Bookmark
 * Format: [tag1][tag2] summary
 * Note: Tags don't count toward the 100 character comment limit
 */
function formatCommentWithTags(summary: string, tags: string[]): string {
  const tagPart = tags.map((t) => `[${t}]`).join("");
  // Tags don't count toward comment limit, so summary can be full 100 chars
  return `${tagPart}${summary}`;
}

export async function POST(request: NextRequest) {
  try {
    // CSRF protection: verify Origin/Referer
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const requestUrl = new URL(request.url);
    const expectedOrigin = requestUrl.origin;

    // Check that the request comes from our own origin
    if (origin && origin !== expectedOrigin) {
      return NextResponse.json({ success: false, error: "Invalid origin" } as BookmarkResponse, {
        status: 403,
      });
    }

    // Fallback to referer check if origin is not present
    if (!origin && referer) {
      const refererUrl = new URL(referer);
      if (refererUrl.origin !== expectedOrigin) {
        return NextResponse.json({ success: false, error: "Invalid referer" } as BookmarkResponse, {
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
      return NextResponse.json({ success: false, error: "Not authenticated" } as BookmarkResponse, {
        status: 401,
      });
    }

    // Get Hatena tokens from database
    const db = getDb(env.DB);

    const tokens = await db
      .select()
      .from(hatenaTokens)
      .where(eq(hatenaTokens.userId, session.user.id))
      .get();

    if (!tokens) {
      return NextResponse.json(
        { success: false, error: "Hatena not connected" } as BookmarkResponse,
        { status: 400 },
      );
    }

    const { accessToken: hatenaAccessToken, accessTokenSecret: hatenaAccessTokenSecret } = tokens;

    console.log("[bookmark] session.user.id:", session.user.id);
    console.log("[bookmark] DB tokens - userId:", tokens.userId);
    console.log("[bookmark] DB tokens - scope:", tokens.scope);
    console.log("[bookmark] DB tokens - updatedAt:", tokens.updatedAt);

    // Get consumer credentials from env
    const consumerKey = env.HATENA_CONSUMER_KEY;
    const consumerSecret = env.HATENA_CONSUMER_SECRET;

    console.log("[bookmark] env.HATENA_CONSUMER_KEY exists:", !!consumerKey);
    console.log("[bookmark] env.HATENA_CONSUMER_SECRET exists:", !!consumerSecret);

    if (!consumerKey || !consumerSecret) {
      console.error("Missing HATENA_CONSUMER_KEY or HATENA_CONSUMER_SECRET in env");
      return NextResponse.json(
        { success: false, error: "Server configuration error" } as BookmarkResponse,
        { status: 500 },
      );
    }

    // Parse request body
    const body: BookmarkRequest = await request.json();
    const { url, comment } = body;

    console.log("[bookmark] Request - url:", url);
    console.log("[bookmark] Request - comment:", comment ? `"${comment.substring(0, 30)}..."` : "(empty)");

    if (!url) {
      return NextResponse.json({ success: false, error: "URL is required" } as BookmarkResponse, {
        status: 400,
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format" } as BookmarkResponse,
        { status: 400 },
      );
    }

    // Track generated content for response
    let generatedSummary: string | undefined;
    let generatedTags: string[] | undefined;
    let generatedComment: string | undefined;

    // Determine comment to use
    let finalComment = comment;

    // If no comment provided, generate AI suggestions using Mastra workflow
    if (!comment) {
      try {
        // Fetch user's existing Hatena tags
        const existingTags = await fetchHatenaTags(
          hatenaAccessToken,
          hatenaAccessTokenSecret,
          consumerKey,
          consumerSecret,
        );

        // Run the bookmark suggestion workflow
        const workflow = mastra.getWorkflow("bookmark-suggestion");
        const run = await workflow.createRunAsync();
        const result = await run.start({
          inputData: {
            url,
            existingTags,
            cfAccountId: env.BROWSER_RENDERING_ACCOUNT_ID!,
            cfApiToken: env.BROWSER_RENDERING_API_TOKEN!,
          },
        });

        if (result.status !== "success" || !result.result) {
          throw new Error("Workflow failed");
        }

        const { summary, tags } = result.result;

        // Store generated content
        generatedSummary = summary;
        generatedTags = tags;

        // Format comment with tags
        finalComment = formatCommentWithTags(summary, tags);
        generatedComment = finalComment;
      } catch (aiError) {
        console.error("AI suggestion failed:", aiError);
        return NextResponse.json(
          {
            success: false,
            error: aiError instanceof Error ? aiError.message : "AI suggestion failed",
          } as BookmarkResponse,
          { status: 500 },
        );
      }
    }

    // Prepare request body parameters
    const bodyParams: Record<string, string> = { url };
    if (finalComment) {
      bodyParams.comment = finalComment;
    }

    // Create OAuth signed request
    const authHeaders = createSignedRequest(
      HATENA_BOOKMARK_API_URL,
      "POST",
      hatenaAccessToken,
      hatenaAccessTokenSecret,
      consumerKey,
      consumerSecret,
      bodyParams,
    );

    // Make request to Hatena Bookmark API
    const response = await fetch(HATENA_BOOKMARK_API_URL, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(bodyParams).toString(),
    });

    console.log("[bookmark] Hatena Bookmark API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      const wwwAuth = response.headers.get("WWW-Authenticate");

      // Log OAuth problem code if present
      console.error("[bookmark] Hatena Bookmark API error:", response.status, errorText);
      console.error("[bookmark] WWW-Authenticate:", wwwAuth);
      const problemMatch = wwwAuth?.match(/oauth_problem="([^"]+)"/);
      if (problemMatch) {
        console.error("[bookmark] OAuth Problem:", problemMatch[1]);
      }

      // Try to parse error message from Hatena
      let errorMessage = `Hatena API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        // If not JSON, use raw text
        if (errorText) {
          errorMessage = errorText;
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        } as BookmarkResponse,
        { status: response.status },
      );
    }

    // Success - include generated content in response
    const successResponse: BookmarkResponse = {
      success: true,
      generatedComment,
      generatedSummary,
      generatedTags,
    };

    return NextResponse.json(successResponse, { status: 200 });
  } catch (error) {
    console.error("Bookmark API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      } as BookmarkResponse,
      { status: 500 },
    );
  }
}
