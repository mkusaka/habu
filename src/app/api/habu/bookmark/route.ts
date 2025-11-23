import { NextRequest, NextResponse } from "next/server";
import { getHabuSession } from "@/lib/auth";
import { createSignedRequest } from "@/lib/hatena-oauth";
import type { BookmarkRequest, BookmarkResponse } from "@/types/habu";

export const runtime = "edge";

const HATENA_BOOKMARK_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/bookmark";

export async function POST(request: NextRequest) {
  try {
    // Get Hatena tokens from cookies
    const hatenaAccessToken = request.cookies.get("hatena_access_token")?.value;
    const hatenaAccessTokenSecret = request.cookies.get("hatena_access_token_secret")?.value;

    if (!hatenaAccessToken || !hatenaAccessTokenSecret) {
      return NextResponse.json(
        { success: false, error: "Hatena not connected" } as BookmarkResponse,
        { status: 400 }
      );
    }

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

    // Prepare Hatena API request
    const apiUrl = new URL(HATENA_BOOKMARK_API_URL);
    apiUrl.searchParams.set("url", url);
    if (comment) {
      apiUrl.searchParams.set("comment", comment);
    }

    // Create OAuth signed request
    const authHeaders = createSignedRequest(
      apiUrl.toString(),
      "POST",
      hatenaAccessToken,
      hatenaAccessTokenSecret
    );

    // Make request to Hatena Bookmark API
    const response = await fetch(apiUrl.toString(), {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Hatena API error:", errorText);
      return NextResponse.json(
        {
          success: false,
          error: `Hatena API error: ${response.status}`
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
