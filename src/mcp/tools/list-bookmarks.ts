import { z } from "zod";
import { createSignedRequest } from "@/lib/hatena-oauth";
import type { McpContext, ToolResult } from "../types";
import { hasScope } from "../types";

const HATENA_MY_API_URL = "https://bookmark.hatenaapis.com/rest/1/my";

export const listBookmarksSchema = z.object({
  limit: z.number().min(1).max(100).default(20).describe("Number of bookmarks to return (1-100)"),
  offset: z.number().min(0).default(0).describe("Offset for pagination"),
});

export type ListBookmarksInput = z.infer<typeof listBookmarksSchema>;

export interface BookmarkItem {
  url: string;
  title: string;
  comment: string;
  tags: string[];
  bookmarkedAt: string;
}

export interface ListBookmarksResult {
  bookmarks: BookmarkItem[];
  username: string;
}

interface HatenaMyResponse {
  name: string;
}

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

export async function listBookmarks(
  input: ListBookmarksInput,
  context: McpContext,
  env: { HATENA_CONSUMER_KEY: string; HATENA_CONSUMER_SECRET: string },
): Promise<ToolResult<ListBookmarksResult>> {
  // Check scope
  if (!hasScope(context, "bookmark:read")) {
    return { success: false, error: "Permission denied: bookmark:read scope required" };
  }

  // Check Hatena connection
  if (!context.hatenaToken) {
    return { success: false, error: "Hatena not connected" };
  }

  const { accessToken, accessTokenSecret } = context.hatenaToken;
  const { limit, offset } = input;

  // First, get the username
  const authHeaders = createSignedRequest(
    HATENA_MY_API_URL,
    "GET",
    accessToken,
    accessTokenSecret,
    env.HATENA_CONSUMER_KEY,
    env.HATENA_CONSUMER_SECRET,
  );

  const myResponse = await fetch(HATENA_MY_API_URL, {
    method: "GET",
    headers: authHeaders,
  });

  if (!myResponse.ok) {
    const errorText = await myResponse.text();
    return {
      success: false,
      error: `Failed to get user info: ${myResponse.status} - ${errorText}`,
    };
  }

  const myData = (await myResponse.json()) as HatenaMyResponse;
  const username = myData.name;

  // Fetch bookmarks using unofficial API (supports proper pagination)
  const bookmarksApiUrl = `https://b.hatena.ne.jp/api/users/${username}/bookmarks?limit=${limit}&offset=${offset}`;

  const bookmarksResponse = await fetch(bookmarksApiUrl, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!bookmarksResponse.ok) {
    return {
      success: false,
      error: `Failed to fetch bookmarks: ${bookmarksResponse.status}`,
    };
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

  return {
    success: true,
    data: {
      bookmarks,
      username,
    },
  };
}
