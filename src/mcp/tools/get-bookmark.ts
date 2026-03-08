import { z } from "zod";
import type { McpContext, ToolResult } from "../types";
import { sendHatenaBookmarkRequest } from "./hatena-bookmark-request";

export const getBookmarkSchema = z.object({
  url: z.string().url().describe("The URL to get bookmark information for"),
});

type GetBookmarkInput = z.infer<typeof getBookmarkSchema>;

interface BookmarkInfo {
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
  const requestResult = await sendHatenaBookmarkRequest(
    input.url,
    "GET",
    "bookmark:read",
    context,
    env,
  );
  if (!requestResult.success) {
    return requestResult;
  }

  const { response } = requestResult.data;

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
