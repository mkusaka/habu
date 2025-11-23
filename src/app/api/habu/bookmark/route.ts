import { NextRequest, NextResponse } from "next/server";
import { createSignedRequest } from "@/lib/hatena-oauth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db/client";
import { hatenaTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createAuth } from "@/lib/auth";
import type { BookmarkRequest, BookmarkResponse } from "@/types/habu";

const HATENA_BOOKMARK_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/bookmark";

export async function POST(request: NextRequest) {
  try {
    // CSRF protection: verify Origin/Referer
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const requestUrl = new URL(request.url);
    const expectedOrigin = requestUrl.origin;

    // Check that the request comes from our own origin
    if (origin && origin !== expectedOrigin) {
      return NextResponse.json(
        { success: false, error: "Invalid origin" } as BookmarkResponse,
        { status: 403 }
      );
    }

    // Fallback to referer check if origin is not present
    if (!origin && referer) {
      const refererUrl = new URL(referer);
      if (refererUrl.origin !== expectedOrigin) {
        return NextResponse.json(
          { success: false, error: "Invalid referer" } as BookmarkResponse,
          { status: 403 }
        );
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
      return NextResponse.json(
        { success: false, error: "Not authenticated" } as BookmarkResponse,
        { status: 401 }
      );
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
        { status: 400 }
      );
    }

    const { accessToken: hatenaAccessToken, accessTokenSecret: hatenaAccessTokenSecret } = tokens;

    // Parse request body
    const body: BookmarkRequest = await request.json();
    const { url, comment } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: "URL is required" } as BookmarkResponse,
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format" } as BookmarkResponse,
        { status: 400 }
      );
    }

    // Prepare request body parameters
    const bodyParams: Record<string, string> = { url };
    if (comment) {
      bodyParams.comment = comment;
    }

    // Create OAuth signed request
    const authHeaders = createSignedRequest(
      HATENA_BOOKMARK_API_URL,
      "POST",
      hatenaAccessToken,
      hatenaAccessTokenSecret,
      bodyParams
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
          error: errorMessage
        } as BookmarkResponse,
        { status: response.status }
      );
    }

    // Success
    return NextResponse.json(
      { success: true } as BookmarkResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error("Bookmark API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error"
      } as BookmarkResponse,
      { status: 500 }
    );
  }
}
