import { NextRequest, NextResponse } from "next/server";
import { createSignedRequest } from "@/lib/hatena-oauth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createAuth } from "@/lib/auth";

const HATENA_MY_API_URL = "https://bookmark.hatenaapis.com/rest/1/my";

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

export interface BookmarksResponse {
  success: boolean;
  error?: string;
  bookmarks?: BookmarkItem[];
  username?: string;
}

/**
 * Parse RSS XML to extract bookmark items
 */
function parseRssXml(xml: string): BookmarkItem[] {
  const items: BookmarkItem[] = [];

  // Simple regex-based XML parsing (works for RSS structure)
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1];

    // Extract fields
    const linkMatch = itemContent.match(/<link>([^<]+)<\/link>/);
    const titleMatch = itemContent.match(/<title>([^<]+)<\/title>/);
    const descMatch = itemContent.match(/<description>([^<]*)<\/description>/);
    const dateMatch = itemContent.match(/<dc:date>([^<]+)<\/dc:date>/);

    // Extract tags (dc:subject elements)
    const tagRegex = /<dc:subject>([^<]+)<\/dc:subject>/g;
    const tags: string[] = [];
    let tagMatch;
    while ((tagMatch = tagRegex.exec(itemContent)) !== null) {
      tags.push(decodeXmlEntities(tagMatch[1]));
    }

    if (linkMatch) {
      items.push({
        url: decodeXmlEntities(linkMatch[1]),
        title: titleMatch ? decodeXmlEntities(titleMatch[1]) : "",
        comment: descMatch ? decodeXmlEntities(descMatch[1]) : "",
        tags,
        bookmarkedAt: dateMatch ? dateMatch[1] : "",
      });
    }
  }

  return items;
}

/**
 * Decode common XML entities
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Get user's bookmarks list
 * GET /api/habu/bookmarks?limit=20&offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Get DB connection for auth
    const { env } = getCloudflareContext();
    const auth = createAuth(env.DB);

    // Get current user session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Not authenticated" } as BookmarksResponse, {
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
        { success: false, error: "Hatena not connected" } as BookmarksResponse,
        { status: 400 },
      );
    }

    const { accessToken: hatenaAccessToken, accessTokenSecret: hatenaAccessTokenSecret } = user.hatenaToken;

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
        { success: false, error: `Failed to get user info: ${myResponse.status} - ${errorText}` } as BookmarksResponse,
        { status: myResponse.status },
      );
    }

    const myData = (await myResponse.json()) as HatenaMyResponse;
    const username = myData.name;

    // Fetch RSS feed (public, no auth needed)
    // Note: RSS only returns ~20 items at a time, so we use the of parameter for pagination
    const rssUrl = `https://b.hatena.ne.jp/${username}/rss?of=${offset}`;

    const rssResponse = await fetch(rssUrl, {
      headers: {
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!rssResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch bookmarks: ${rssResponse.status}` } as BookmarksResponse,
        { status: rssResponse.status },
      );
    }

    const rssXml = await rssResponse.text();
    const allBookmarks = parseRssXml(rssXml);

    // Apply limit (RSS returns all items, we need to slice)
    const bookmarks = allBookmarks.slice(0, limit);

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
