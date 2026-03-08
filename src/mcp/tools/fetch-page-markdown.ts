import { z } from "zod";
import { fetchPageMarkdown, isUrlSafeToFetch, type PageMarkdownSource } from "@/lib/page-markdown";
import type { McpContext, ToolResult } from "../types";

export const fetchPageMarkdownSchema = z.object({
  url: z.string().url().describe("The public URL of the web page to fetch as markdown"),
});

type FetchPageMarkdownInput = z.infer<typeof fetchPageMarkdownSchema>;

interface FetchPageMarkdownResult {
  url: string;
  markdown: string;
  source?: PageMarkdownSource;
}

export async function fetchPageMarkdownTool(
  input: FetchPageMarkdownInput,
  _context: McpContext,
  env: { BROWSER_RENDERING_ACCOUNT_ID?: string; BROWSER_RENDERING_API_TOKEN?: string },
): Promise<ToolResult<FetchPageMarkdownResult>> {
  const urlCheck = isUrlSafeToFetch(input.url);
  if (!urlCheck.valid) {
    return { success: false, error: urlCheck.error ?? "Invalid URL" };
  }

  const result = await fetchPageMarkdown(input.url, {
    cfAccountId: env.BROWSER_RENDERING_ACCOUNT_ID,
    cfApiToken: env.BROWSER_RENDERING_API_TOKEN,
  });

  if (result.error) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: {
      url: input.url,
      markdown: result.markdown,
      source: result.source,
    },
  };
}
