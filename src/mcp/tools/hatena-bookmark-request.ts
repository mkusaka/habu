import type { McpScope } from "@/lib/auth";
import { createSignedRequest } from "@/lib/hatena-oauth";
import type { McpContext, ToolResult } from "../types";
import { hasScope } from "../types";

const HATENA_BOOKMARK_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/bookmark";

type HatenaEnv = {
  HATENA_CONSUMER_KEY: string;
  HATENA_CONSUMER_SECRET: string;
};

export async function sendHatenaBookmarkRequest(
  url: string,
  method: "GET" | "DELETE",
  requiredScope: McpScope,
  context: McpContext,
  env: HatenaEnv,
): Promise<ToolResult<{ apiUrl: string; response: Response }>> {
  if (!hasScope(context, requiredScope)) {
    return { success: false, error: `Permission denied: ${requiredScope} scope required` };
  }

  if (!context.hatenaToken) {
    return { success: false, error: "Hatena not connected" };
  }

  const { accessToken, accessTokenSecret } = context.hatenaToken;
  const apiUrl = `${HATENA_BOOKMARK_API_URL}?url=${encodeURIComponent(url)}`;
  const headers = createSignedRequest(
    apiUrl,
    method,
    accessToken,
    accessTokenSecret,
    env.HATENA_CONSUMER_KEY,
    env.HATENA_CONSUMER_SECRET,
  );

  const response = await fetch(apiUrl, {
    method,
    headers,
  });

  return {
    success: true,
    data: {
      apiUrl,
      response,
    },
  };
}
