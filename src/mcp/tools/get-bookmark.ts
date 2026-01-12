import { z } from "zod";
import { createSignedRequest } from "@/lib/hatena-oauth";
import type { McpContext, ToolResult } from "../types";
import { hasScope } from "../types";

const HATENA_BOOKMARK_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/bookmark";

export const getBookmarkSchema = z.object({
  url: z.string().url().describe("The URL to get bookmark information for"),
});

export type GetBookmarkInput = z.infer<typeof getBookmarkSchema>;

export interface BookmarkInfo {
  url: string;
  comment: string;
  tags: string[];
  createdAt: string;
}

export async function getBookmark(
  input: GetBookmarkInput,
  context: McpContext,
  env: { HATENA_CONSUMER_KEY: string; HATENA_CONSUMER_SECRET: string },
): Promise<ToolResult<BookmarkInfo>> {
  // Check scope
  if (!hasScope(context, "bookmark:read")) {
    return { success: false, error: "Permission denied: bookmark:read scope required" };
  }

  // Check Hatena connection
  if (!context.hatenaToken) {
    return { success: false, error: "Hatena not connected" };
  }

  const { accessToken, accessTokenSecret } = context.hatenaToken;

  // Build API URL
  const apiUrl = `${HATENA_BOOKMARK_API_URL}?url=${encodeURIComponent(input.url)}`;

  // Create OAuth signed request
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
    headers: authHeaders,
  });

  if (response.status === 404) {
    return { success: false, error: "Bookmark not found" };
  }

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `Hatena API error: ${response.status} - ${errorText}` };
  }

  const bookmark = (await response.json()) as {
    url: string;
    comment: string;
    tags: string[];
    created_datetime: string;
  };

  return {
    success: true,
    data: {
      url: bookmark.url,
      comment: bookmark.comment,
      tags: bookmark.tags,
      createdAt: bookmark.created_datetime,
    },
  };
}
