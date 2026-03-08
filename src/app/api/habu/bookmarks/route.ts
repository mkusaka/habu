import { NextRequest, NextResponse } from "next/server";
import { createSignedRequest } from "@/lib/hatena-oauth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createAuth } from "@/lib/auth";
import { appendTagFilters, normalizeTagFilters } from "@/lib/bookmark-tag-filter";

const HATENA_MY_API_URL = "https://bookmark.hatenaapis.com/rest/1/my";
const PAGE_SIZE = 20;

interface HatenaMyResponse {
  name: string;
}

export interface BookmarkItem {
  url: string;
  title: string;
  comment: string;
  tags: string[];
  bookmarkedAt: string;
}

// Unofficial API response types
interface HatenaBookmarkEntry {
  title: string;
  canonical_url: string;
}

interface HatenaBookmarkItem {
  url: string;
  comment: string;
  tags: string[];
  created: string;
  entry: HatenaBookmarkEntry;
}

interface HatenaBookmarksApiResponse {
  item: {
    bookmarks: HatenaBookmarkItem[];
  };
}

export interface BookmarksResponse {
  success: boolean;
  error?: string;
  bookmarks?: BookmarkItem[];
  username?: string;
}

/**
 * Get user's bookmarks list
 * GET /api/habu/bookmarks?page=2&tag=AI%E8%A6%81%E7%B4%84&tag=2025
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const pageParam = parseInt(searchParams.get("page") || "", 10);
    const page =
      Number.isFinite(pageParam) && pageParam > 0
        ? pageParam
        : Math.floor(Math.max(offset, 0) / PAGE_SIZE) + 1;
    const tags = normalizeTagFilters(searchParams.getAll("tag"));

    // Get DB connection for auth
    const { env } = getCloudflareContext();
    const auth = createAuth(env.DB);

    // Get current user session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" } as BookmarksResponse,
        {
          status: 401,
        },
      );
    }

    // Get user with hatenaToken relation
    const db = getDb(env.DB);

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      with: { hatenaToken: true },
    });

    if (!user?.hatenaToken) {
      return NextResponse.json(
        { success: false, error: "Hatena not connected" } as BookmarksResponse,
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
        { success: false, error: "Server configuration error" } as BookmarksResponse,
        { status: 500 },
      );
    }

    // First, get the username
    const authHeaders = createSignedRequest(
      HATENA_MY_API_URL,
      "GET",
      hatenaAccessToken,
      hatenaAccessTokenSecret,
      consumerKey,
      consumerSecret,
    );

    const myResponse = await fetch(HATENA_MY_API_URL, {
      method: "GET",
      headers: authHeaders,
    });

    if (!myResponse.ok) {
      const errorText = await myResponse.text();
      return NextResponse.json(
        {
          success: false,
          error: `Failed to get user info: ${myResponse.status} - ${errorText}`,
        } as BookmarksResponse,
        { status: myResponse.status },
      );
    }

    const myData = (await myResponse.json()) as HatenaMyResponse;
    const username = myData.name;

    // Hatena's public JSON endpoint exposes fixed-size page-based pagination.
    const bookmarkParams = new URLSearchParams({ page: String(page) });
    appendTagFilters(bookmarkParams, tags);
    const bookmarksApiUrl = `https://b.hatena.ne.jp/api/users/${username}/bookmarks?${bookmarkParams.toString()}`;

    const bookmarksResponse = await fetch(bookmarksApiUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!bookmarksResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch bookmarks: ${bookmarksResponse.status}`,
        } as BookmarksResponse,
        { status: bookmarksResponse.status },
      );
    }

    const bookmarksData = (await bookmarksResponse.json()) as HatenaBookmarksApiResponse;

    // Map to BookmarkItem format
    const bookmarks: BookmarkItem[] = bookmarksData.item.bookmarks.map((item) => ({
      url: item.entry.canonical_url || item.url,
      title: item.entry.title,
      comment: item.comment,
      tags: item.tags,
      bookmarkedAt: item.created,
    }));

    return NextResponse.json({
      success: true,
      bookmarks,
      username,
    } as BookmarksResponse);
  } catch (error) {
    console.error("Bookmarks API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      } as BookmarksResponse,
      { status: 500 },
    );
  }
}
