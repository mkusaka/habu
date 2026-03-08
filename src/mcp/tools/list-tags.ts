import { z } from "zod";
import { fetchHatenaTags } from "@/lib/hatena-bookmark-api";
import type { McpContext, ToolResult } from "../types";
import { hasScope } from "../types";

export const listTagsSchema = z.object({
  limit: z.number().min(1).max(100).default(50).describe("Number of tags to return (1-100)"),
});

type ListTagsInput = z.infer<typeof listTagsSchema>;

interface TagItem {
  tag: string;
  count: number;
}

interface ListTagsResult {
  tags: TagItem[];
}

export async function listTags(
  input: ListTagsInput,
  context: McpContext,
  env: { HATENA_CONSUMER_KEY: string; HATENA_CONSUMER_SECRET: string },
): Promise<ToolResult<ListTagsResult>> {
  if (!hasScope(context, "bookmark:read")) {
    return { success: false, error: "Permission denied: bookmark:read scope required" };
  }

  if (!context.hatenaToken) {
    return { success: false, error: "Hatena not connected" };
  }

  const tags = await fetchHatenaTags({
    accessToken: context.hatenaToken.accessToken,
    accessTokenSecret: context.hatenaToken.accessTokenSecret,
    consumerKey: env.HATENA_CONSUMER_KEY,
    consumerSecret: env.HATENA_CONSUMER_SECRET,
  });

  return {
    success: true,
    data: {
      tags: tags.slice(0, input.limit),
    },
  };
}
