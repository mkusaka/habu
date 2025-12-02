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
  const authHeaders = createSignedRequest(
    HATENA_TAGS_API_URL,
    "GET",
    accessToken,
    accessTokenSecret,
    consumerKey,
    consumerSecret,
  );

  const response = await fetch(HATENA_TAGS_API_URL, {
    method: "GET",
    headers: authHeaders,
  });

  if (!response.ok) {
    // If 401, likely missing read_private scope - return empty array
    if (response.status === 401) {
      console.warn("Cannot fetch tags - may need read_private scope");
      return [];
    }
    const errorText = await response.text();
    throw new Error(`Hatena Tags API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as HatenaTagsResponse;
  return data.tags.map((t) => t.tag);
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

    // Get consumer credentials from env
    const consumerKey = env.HATENA_CONSUMER_KEY;
    const consumerSecret = env.HATENA_CONSUMER_SECRET;

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
            cfAccountId: env.CF_ACCOUNT_ID!,
            cfApiToken: env.CLOUDFLARE_API_TOKEN!,
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Hatena API error:", errorText);

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
