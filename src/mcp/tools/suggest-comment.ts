import { z } from "zod";
import { createSignedRequest } from "@/lib/hatena-oauth";
import type { McpContext, ToolResult } from "../types";
import { hasScope } from "../types";
import { mastra } from "@/mastra";
import { RequestContext } from "@mastra/core/di";

const HATENA_TAGS_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/tags";

export const suggestCommentSchema = z.object({
  url: z.string().url().describe("The URL to generate a bookmark suggestion for"),
  userContext: z
    .string()
    .optional()
    .describe("Optional user-provided context or instructions for the AI suggestion"),
});

export type SuggestCommentInput = z.infer<typeof suggestCommentSchema>;

export interface SuggestCommentResult {
  summary: string;
  tags: string[];
  formattedComment: string;
  canonicalUrl?: string;
}

interface HatenaTagsResponse {
  tags: { tag: string; count: number }[];
}

async function fetchHatenaTags(
  accessToken: string,
  accessTokenSecret: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<string[]> {
  const authHeaders = createSignedRequest(
    HATENA_TAGS_API_URL,
    "GET",
    accessToken,
    accessTokenSecret,
    consumerKey,
    consumerSecret,
  );

  const response = await fetch(HATENA_TAGS_API_URL, {
    method: "GET",
    headers: authHeaders,
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error(`Hatena Tags API redirect detected: ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(`Hatena Tags API error: ${response.status}`);
  }

  const data = (await response.json()) as HatenaTagsResponse;
  return data.tags.map((t) => t.tag);
}

export async function suggestComment(
  input: SuggestCommentInput,
  context: McpContext,
  env: { HATENA_CONSUMER_KEY: string; HATENA_CONSUMER_SECRET: string },
): Promise<ToolResult<SuggestCommentResult>> {
  // Check scope
  if (!hasScope(context, "bookmark:suggest")) {
    return { success: false, error: "Permission denied: bookmark:suggest scope required" };
  }

  // Check Hatena connection
  if (!context.hatenaToken) {
    return { success: false, error: "Hatena not connected" };
  }

  const { accessToken, accessTokenSecret } = context.hatenaToken;

  try {
    // Fetch user's existing Hatena tags
    const existingTags = await fetchHatenaTags(
      accessToken,
      accessTokenSecret,
      env.HATENA_CONSUMER_KEY,
      env.HATENA_CONSUMER_SECRET,
    );

    // Run the bookmark suggestion workflow
    const workflow = mastra.getWorkflow("bookmark-suggestion");
    const run = await workflow.createRun();

    // Create RequestContext with metadata for tracing
    const requestContext = new RequestContext();
    requestContext.set("userId", context.userId);
    requestContext.set("url", input.url);

    const result = await run.start({
      inputData: {
        url: input.url,
        existingTags,
        userContext: input.userContext,
      },
      requestContext,
    });

    if (result.status !== "success" || !result.result) {
      throw new Error("Workflow failed");
    }

    const { summary, tags, canonicalUrl } = result.result;

    // Validate results
    if (!summary || summary.length < 10) {
      throw new Error("Failed to generate summary");
    }

    const meaningfulTags = tags.filter((t: string) => t !== "AI要約");
    if (meaningfulTags.length === 0) {
      throw new Error("Failed to generate tags");
    }

    // Format comment with tags
    const tagPart = tags.map((t: string) => `[${t}]`).join("");
    const formattedComment = `${tagPart}${summary}`;

    return {
      success: true,
      data: {
        summary,
        tags,
        formattedComment,
        canonicalUrl: canonicalUrl || undefined,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "AI suggestion failed",
    };
  }
}
