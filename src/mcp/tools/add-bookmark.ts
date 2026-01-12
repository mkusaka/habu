import { z } from "zod";
import { createSignedRequest } from "@/lib/hatena-oauth";
import type { McpContext, ToolResult } from "../types";
import { hasScope } from "../types";

const HATENA_BOOKMARK_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/bookmark";

export const addBookmarkSchema = z.object({
  url: z.string().url().describe("The URL to bookmark"),
  comment: z
    .string()
    .max(100)
    .optional()
    .describe("Optional comment for the bookmark (max 100 characters)"),
  tags: z
    .array(z.string())
    .max(10)
    .optional()
    .describe("Optional tags for the bookmark (max 10 tags)"),
});

export type AddBookmarkInput = z.infer<typeof addBookmarkSchema>;

export interface AddBookmarkResult {
  url: string;
  comment: string;
}

export async function addBookmark(
  input: AddBookmarkInput,
  context: McpContext,
  env: { HATENA_CONSUMER_KEY: string; HATENA_CONSUMER_SECRET: string },
): Promise<ToolResult<AddBookmarkResult>> {
  // Check scope
  if (!hasScope(context, "bookmark:write")) {
    return { success: false, error: "Permission denied: bookmark:write scope required" };
  }

  // Check Hatena connection
  if (!context.hatenaToken) {
    return { success: false, error: "Hatena not connected" };
  }

  const { accessToken, accessTokenSecret } = context.hatenaToken;

  // Format comment with tags if provided
  let finalComment = input.comment || "";
  if (input.tags && input.tags.length > 0) {
    const tagPart = input.tags.map((t) => `[${t}]`).join("");
    finalComment = `${tagPart}${finalComment}`;
  }

  // Prepare request body parameters
  const bodyParams: Record<string, string> = { url: input.url };
  if (finalComment) {
    bodyParams.comment = finalComment;
  }

  // Create OAuth signed request
  const authHeaders = createSignedRequest(
    HATENA_BOOKMARK_API_URL,
    "POST",
    accessToken,
    accessTokenSecret,
    env.HATENA_CONSUMER_KEY,
    env.HATENA_CONSUMER_SECRET,
    bodyParams,
  );

  // Make request to Hatena Bookmark API
  const response = await fetch(HATENA_BOOKMARK_API_URL, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(bodyParams).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Hatena API error: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      if (errorText) {
        errorMessage = errorText;
      }
    }
    return { success: false, error: errorMessage };
  }

  return {
    success: true,
    data: {
      url: input.url,
      comment: finalComment,
    },
  };
}
