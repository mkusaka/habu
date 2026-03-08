import { buildMcpContextForUser } from "@/lib/bookmark-user-context";
import type { ChatContext, PageMetadata } from "@/lib/chat-context";
import { fetchPageMeta, isMetaExtractionResult } from "@/lib/page-meta";
import { getBookmark } from "@/mcp/tools/get-bookmark";

export async function buildChatPageContextForUser(params: {
  userId: string;
  url?: string;
  query?: string;
  dbBinding: D1Database;
  env: {
    HATENA_CONSUMER_KEY: string;
    HATENA_CONSUMER_SECRET: string;
  };
}): Promise<{
  context: ChatContext;
  title: string;
}> {
  const [mcpContext, metaResult] = await Promise.all([
    buildMcpContextForUser(params.userId, params.dbBinding),
    params.url ? fetchPageMeta(params.url).catch(() => null) : Promise.resolve(null),
  ]);

  let metadata: PageMetadata | undefined;
  if (metaResult && isMetaExtractionResult(metaResult)) {
    metadata = {
      title: metaResult.title || metaResult.og?.title || metaResult.twitter?.title,
      description:
        metaResult.description || metaResult.og?.description || metaResult.twitter?.description,
      lang: metaResult.lang,
      ogType: metaResult.og?.type,
      siteName: metaResult.og?.site_name,
      keywords: metaResult.keywords,
      author: metaResult.author,
    };
  }

  let existingComment: string | undefined;
  let existingTags: string[] | undefined;

  if (params.url && mcpContext?.hatenaToken) {
    const bookmarkResult = await getBookmark({ url: params.url }, mcpContext, {
      HATENA_CONSUMER_KEY: params.env.HATENA_CONSUMER_KEY,
      HATENA_CONSUMER_SECRET: params.env.HATENA_CONSUMER_SECRET,
    });

    if (bookmarkResult.success) {
      existingComment = bookmarkResult.data.comment || undefined;
      existingTags = bookmarkResult.data.tags.length > 0 ? bookmarkResult.data.tags : undefined;
    }
  }

  return {
    context: {
      url: params.url,
      query: params.query,
      metadata,
      existingComment,
      existingTags,
    },
    title: metadata?.title || params.query || params.url || "Search Session",
  };
}
