import { z } from "zod";
import type { McpContext, ToolResult } from "../types";
import { sendHatenaBookmarkRequest } from "./hatena-bookmark-request";

export const deleteBookmarkSchema = z.object({
  url: z.string().url().describe("The URL of the bookmark to delete"),
});

type DeleteBookmarkInput = z.infer<typeof deleteBookmarkSchema>;

interface DeleteBookmarkResult {
  url: string;
  deleted: boolean;
}

export async function deleteBookmark(
  input: DeleteBookmarkInput,
  context: McpContext,
  env: { HATENA_CONSUMER_KEY: string; HATENA_CONSUMER_SECRET: string },
): Promise<ToolResult<DeleteBookmarkResult>> {
  const requestResult = await sendHatenaBookmarkRequest(
    input.url,
    "DELETE",
    "bookmark:delete",
    context,
    env,
  );
  if (!requestResult.success) {
    return requestResult;
  }

  const { response } = requestResult.data;

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
