import { MetaCollector, HtmlHandler, TitleHandler, MetaHandler, LinkHandler } from "./collector";
import type { MetaExtractionResult, NonHtmlResponse, PageMetaResult } from "./types";

export type { MetaExtractionResult, NonHtmlResponse, PageMetaResult };

const LOOP_DETECTION_HEADER = "X-Page-Meta-Request";

/**
 * Fetch and extract page metadata using HTMLRewriter
 * This is a direct implementation without external proxy dependencies
 */
export async function fetchPageMeta(url: string): Promise<PageMetaResult> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    throw new Error("Unsupported protocol");
  }

  const res = await fetch(target.toString(), {
    redirect: "follow",
    headers: {
      "User-Agent": "HabuMetaFetcher/1.0",
      [LOOP_DETECTION_HEADER]: "1",
    },
  });

  const status = res.status;
  const contentType = res.headers.get("content-type") ?? undefined;

  if (!contentType || !contentType.toLowerCase().includes("text/html")) {
    return {
      requestedUrl: target.toString(),
      finalUrl: res.url,
      status,
      contentType,
      error: "non-html response",
    } as NonHtmlResponse;
  }

  const collector = new MetaCollector(res.url);

  const rewriter = new HTMLRewriter()
    .on("html", new HtmlHandler(collector))
    .on("head > title", new TitleHandler(collector))
    .on("head meta", new MetaHandler(collector))
    .on("head link", new LinkHandler(collector));

  const rewrittenResponse = rewriter.transform(res);
  await rewrittenResponse.arrayBuffer();

  return collector.toResult({
    requestedUrl: target.toString(),
    finalUrl: res.url,
    status,
    contentType,
  });
}

/**
 * Check if the result is a successful HTML extraction
 */
export function isMetaExtractionResult(result: PageMetaResult): result is MetaExtractionResult {
  return !("error" in result);
}
