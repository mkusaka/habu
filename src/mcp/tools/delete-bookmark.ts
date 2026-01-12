import { z } from "zod";
import { createSignedRequest } from "@/lib/hatena-oauth";
import type { McpContext, ToolResult } from "../types";
import { hasScope } from "../types";

const HATENA_BOOKMARK_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/bookmark";

export const deleteBookmarkSchema = z.object({
  url: z.string().url().describe("The URL of the bookmark to delete"),
});

export type DeleteBookmarkInput = z.infer<typeof deleteBookmarkSchema>;

export interface DeleteBookmarkResult {
  url: string;
  deleted: boolean;
}

export async function deleteBookmark(
  input: DeleteBookmarkInput,
  context: McpContext,
  env: { HATENA_CONSUMER_KEY: string; HATENA_CONSUMER_SECRET: string },
): Promise<ToolResult<DeleteBookmarkResult>> {
  // Check scope
  if (!hasScope(context, "bookmark:delete")) {
    return { success: false, error: "Permission denied: bookmark:delete scope required" };
  }

  // Check Hatena connection
  if (!context.hatenaToken) {
    return { success: false, error: "Hatena not connected" };
  }

  const { accessToken, accessTokenSecret } = context.hatenaToken;

  // Build the API URL with the bookmark URL as query param
  const apiUrl = `${HATENA_BOOKMARK_API_URL}?url=${encodeURIComponent(input.url)}`;

  // Create OAuth signed request
  const authHeaders = createSignedRequest(
    apiUrl,
    "DELETE",
    accessToken,
    accessTokenSecret,
    env.HATENA_CONSUMER_KEY,
    env.HATENA_CONSUMER_SECRET,
  );

  const response = await fetch(apiUrl, {
    method: "DELETE",
    headers: authHeaders,
  });

  // 204 No Content means success
  if (response.status === 204 || response.ok) {
    return {
      success: true,
      data: {
        url: input.url,
        deleted: true,
      },
    };
  }

  if (response.status === 404) {
    return { success: false, error: "Bookmark not found" };
  }

  const errorText = await response.text();
  return {
    success: false,
    error: `Hatena API error: ${response.status} - ${errorText}`,
  };
}
