import { MetaCollector, HtmlHandler, TitleHandler, MetaHandler, LinkHandler } from "./collector";
import type { MetaExtractionResult, NonHtmlResponse, PageMetaResult } from "./types";

export type { MetaExtractionResult, NonHtmlResponse, PageMetaResult };

const LOOP_DETECTION_HEADER = "X-Page-Meta-Request";

type TwitterOEmbedResponse = {
  url?: string;
  author_name?: string;
  author_url?: string;
  html?: string;
  provider_name?: string;
  provider_url?: string;
};

function isTwitterStatusUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (
    host !== "twitter.com" &&
    host !== "x.com" &&
    host !== "www.twitter.com" &&
    host !== "www.x.com"
  ) {
    return false;
  }

  // e.g. /{user}/status/{id} (optionally with extra segments)
  return /\/status\/\d+/.test(url.pathname);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(x?)([0-9a-fA-F]+);/g, (_m, isHex, code) => {
      const value = Number.parseInt(code, isHex ? 16 : 10);
      if (!Number.isFinite(value)) return "";
      try {
        return String.fromCodePoint(value);
      } catch {
        return "";
      }
    })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");
}

function extractTweetTextFromOEmbedHtml(html: string): string | undefined {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!match?.[1]) return undefined;

  const withoutBreaks = match[1].replace(/<br\s*\/?\s*>/gi, "\n");
  const stripped = withoutBreaks.replace(/<[^>]*>/g, "");
  const decoded = decodeHtmlEntities(stripped);
  const normalized = decoded.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function extractTwitterHandle(authorUrl?: string): string | undefined {
  if (!authorUrl) return undefined;
  try {
    const u = new URL(authorUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] ? `@${parts[0]}` : undefined;
  } catch {
    return undefined;
  }
}

async function fetchTwitterOEmbed(target: URL): Promise<MetaExtractionResult | null> {
  const oembedUrl = new URL("https://publish.twitter.com/oembed");
  oembedUrl.searchParams.set("url", target.toString());
  oembedUrl.searchParams.set("omit_script", "1");
  oembedUrl.searchParams.set("dnt", "1");

  const res = await fetch(oembedUrl.toString(), {
    redirect: "follow",
    headers: {
      "User-Agent": "HabuMetaFetcher/1.0",
      Accept: "application/json",
      [LOOP_DETECTION_HEADER]: "1",
    },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as TwitterOEmbedResponse;
  const tweetText = data.html ? extractTweetTextFromOEmbedHtml(data.html) : undefined;

  const handle = extractTwitterHandle(data.author_url);
  const titleBase = tweetText ?? target.toString();
  const title = handle ? `${titleBase} (${handle})` : titleBase;

  return {
    requestedUrl: target.toString(),
    finalUrl: data.url ?? target.toString(),
    status: res.status,
    contentType: res.headers.get("content-type") ?? "application/json",
    lang: undefined,
    title,
    description: tweetText,
    canonical: data.url ?? target.toString(),
    charset: undefined,
    themeColor: undefined,
    author: data.author_name,
    keywords: undefined,
    robots: undefined,
    generator: undefined,
    favicon: undefined,
    icons: [],
    alternates: [],
    og: {
      title,
      description: tweetText ?? "",
      site_name: data.provider_name ?? "X",
      type: "article",
      url: data.url ?? target.toString(),
    },
    twitter: {
      title,
      description: tweetText ?? "",
      card: "summary",
    },
    metaByName: {},
    metaByProperty: {},
    metaTags: [],
    linkTags: [],
  };
}

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

  // X/Twitter pages are JS-heavy and often don't include server-rendered meta tags.
  // Prefer the official oEmbed endpoint for tweet URLs.
  if (isTwitterStatusUrl(target)) {
    const twitter = await fetchTwitterOEmbed(target);
    if (twitter) return twitter;
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
