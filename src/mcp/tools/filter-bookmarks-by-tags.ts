import { z } from "zod";
import { createSignedRequest } from "@/lib/hatena-oauth";
import { appendTagFilters, normalizeTagFilters } from "@/lib/bookmark-tag-filter";
import type { McpContext, ToolResult } from "../types";
import { hasScope } from "../types";

const HATENA_MY_API_URL = "https://bookmark.hatenaapis.com/rest/1/my";

export const filterBookmarksByTagsSchema = z.object({
  tags: z.array(z.string()).min(1).max(10).describe("Tags to filter bookmarks by"),
  page: z.number().min(1).default(1).describe("Page number for pagination"),
});

type FilterBookmarksByTagsInput = z.infer<typeof filterBookmarksByTagsSchema>;

interface BookmarkItem {
  url: string;
  title: string;
  comment: string;
  tags: string[];
  bookmarkedAt: string;
}

interface FilterBookmarksByTagsResult {
  tags: string[];
  page: number;
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

export async function filterBookmarksByTags(
  input: FilterBookmarksByTagsInput,
  context: McpContext,
  env: { HATENA_CONSUMER_KEY: string; HATENA_CONSUMER_SECRET: string },
): Promise<ToolResult<FilterBookmarksByTagsResult>> {
  if (!hasScope(context, "bookmark:read")) {
    return { success: false, error: "Permission denied: bookmark:read scope required" };
  }

  if (!context.hatenaToken) {
    return { success: false, error: "Hatena not connected" };
  }

  const tags = normalizeTagFilters(input.tags);
  if (tags.length === 0) {
    return { success: false, error: "At least one valid tag is required" };
  }

  const authHeaders = createSignedRequest(
    HATENA_MY_API_URL,
    "GET",
    context.hatenaToken.accessToken,
    context.hatenaToken.accessTokenSecret,
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
  const bookmarkParams = new URLSearchParams({ page: String(input.page) });
  appendTagFilters(bookmarkParams, tags);
  const bookmarksApiUrl = `https://b.hatena.ne.jp/api/users/${myData.name}/bookmarks?${bookmarkParams.toString()}`;

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
      tags,
      page: input.page,
      bookmarks,
      username: myData.name,
    },
  };
}
