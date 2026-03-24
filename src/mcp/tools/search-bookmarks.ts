import { z } from "zod";
import { createSignedRequest } from "../../lib/hatena-oauth";
import type { McpContext, ToolResult } from "../types";
import { hasScope } from "../types";

const HATENA_SEARCH_API_URL = "https://b.hatena.ne.jp/my/search/json";

export const searchBookmarksSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Search query for bookmarks. Searches title, URL, comment text, and tags."),
  limit: z.number().min(1).max(100).default(10).describe("Number of results to return (1-100)"),
  offset: z.number().min(0).default(0).describe("Offset for pagination"),
});

type SearchBookmarksInput = z.infer<typeof searchBookmarksSchema>;

interface SearchBookmarkItem {
  url: string;
  title: string;
  comment: string;
  tags: string[];
  snippet?: string;
  bookmarkedAt: string;
  isPrivate: boolean;
  bookmarkCount?: number;
}

interface SearchBookmarksResult {
  query: string;
  total: number;
  bookmarks: SearchBookmarkItem[];
}

// Hatena Bookmark fulltext search API response format
// @see https://developer.hatena.ne.jp/ja/documents/bookmark/apis/fulltext_search
interface HatenaSearchBookmarkItem {
  entry?: {
    title?: string;
    url?: string;
    count?: number;
    eid?: number;
    snippet?: string;
  };
  timestamp?: number;
  comment: string;
  /** 1 if private, absent or 0 otherwise */
  is_private?: number;
}

interface HatenaSearchApiResponse {
  meta?: {
    total?: number;
  };
  bookmarks?: HatenaSearchBookmarkItem[];
}

function extractTags(comment: string): string[] {
  const tags: string[] = [];
  let remaining = comment;

  while (true) {
    const match = /^\[([^\]]+)\]/.exec(remaining);
    if (!match) {
      return tags;
    }
    tags.push(match[1]);
    remaining = remaining.slice(match[0].length);
  }
}

function extractCommentText(comment: string): string {
  return comment.replace(/^(\[[^\]]+\])+/, "").trim();
}

function formatBookmarkedAt(timestamp?: number): string {
  if (!timestamp) {
    return "";
  }

  return new Date(timestamp * 1000).toISOString();
}

export async function searchBookmarks(
  input: SearchBookmarksInput,
  context: McpContext,
  env: { HATENA_CONSUMER_KEY: string; HATENA_CONSUMER_SECRET: string },
): Promise<ToolResult<SearchBookmarksResult>> {
  if (!hasScope(context, "bookmark:read")) {
    return { success: false, error: "Permission denied: bookmark:read scope required" };
  }

  if (!context.hatenaToken) {
    return { success: false, error: "Hatena not connected" };
  }

  const { accessToken, accessTokenSecret } = context.hatenaToken;
  const apiUrl = `${HATENA_SEARCH_API_URL}?q=${encodeURIComponent(input.query)}&limit=${input.limit}&of=${input.offset}`;
  const authHeaders = createSignedRequest(
    apiUrl,
    "GET",
    accessToken,
    accessTokenSecret,
    env.HATENA_CONSUMER_KEY,
    env.HATENA_CONSUMER_SECRET,
  );

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      ...authHeaders,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      error: `Hatena search API error: ${response.status} - ${errorText.slice(0, 200)}`,
    };
  }

  const data = (await response.json()) as HatenaSearchApiResponse;
  const bookmarks = (data.bookmarks ?? []).map((item) => ({
    url: item.entry?.url ?? "",
    title: item.entry?.title ?? item.entry?.url ?? "",
    comment: extractCommentText(item.comment),
    tags: extractTags(item.comment),
    snippet: item.entry?.snippet,
    bookmarkedAt: formatBookmarkedAt(item.timestamp),
    isPrivate: item.is_private === 1,
    bookmarkCount: item.entry?.count,
  }));

  return {
    success: true,
    data: {
      query: input.query,
      total: data.meta?.total ?? bookmarks.length,
      bookmarks,
    },
  };
}
