export type TwitterOEmbedResponse = {
  url?: string;
  author_name?: string;
  author_url?: string;
  html?: string;
  provider_name?: string;
  provider_url?: string;
};

export type TwitterOEmbed = {
  url: string;
  canonicalUrl?: string;
  authorName?: string;
  authorUrl?: string;
  authorHandle?: string;
  providerName?: string;
  html?: string;
  text?: string;
};

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

function extractTweetTextFromOEmbedHtml(html: string): string | undefined {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!match?.[1]) return undefined;

  const withoutBreaks = match[1].replace(/<br\s*\/?\s*>/gi, "\n");
  const stripped = withoutBreaks.replace(/<[^>]*>/g, "");
  const decoded = decodeHtmlEntities(stripped);
  const normalized = decoded.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

export function isTwitterStatusUrl(input: string | URL): boolean {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : input;
  } catch {
    return false;
  }

  const host = url.hostname.toLowerCase();
  if (
    host !== "twitter.com" &&
    host !== "x.com" &&
    host !== "www.twitter.com" &&
    host !== "www.x.com" &&
    host !== "mobile.twitter.com" &&
    host !== "mobile.x.com"
  ) {
    return false;
  }

  return /\/status\/\d+/.test(url.pathname);
}

export async function fetchTwitterOEmbed(input: string | URL): Promise<TwitterOEmbed | null> {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : input;
  } catch {
    return null;
  }

  if (!isTwitterStatusUrl(url)) return null;

  const oembedUrl = new URL("https://publish.twitter.com/oembed");
  oembedUrl.searchParams.set("url", url.toString());
  oembedUrl.searchParams.set("omit_script", "1");
  oembedUrl.searchParams.set("dnt", "1");

  const res = await fetch(oembedUrl.toString(), {
    redirect: "follow",
    headers: {
      "User-Agent": "HabuMetaFetcher/1.0",
      Accept: "application/json",
    },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as TwitterOEmbedResponse;
  const authorHandle = extractTwitterHandle(data.author_url);
  const text = data.html ? extractTweetTextFromOEmbedHtml(data.html) : undefined;
  const canonicalUrl = data.url || undefined;

  return {
    url: url.toString(),
    canonicalUrl,
    authorName: data.author_name,
    authorUrl: data.author_url,
    authorHandle,
    providerName: data.provider_name,
    html: data.html,
    text,
  };
}

export function formatTwitterMarkdown(oembed: TwitterOEmbed): string {
  const lines: string[] = [];

  if (oembed.text) lines.push(oembed.text);

  const author =
    oembed.authorName && oembed.authorHandle
      ? `${oembed.authorName} (${oembed.authorHandle})`
      : oembed.authorName || oembed.authorHandle;

  if (author) lines.push(`— ${author}`);
  lines.push(oembed.canonicalUrl || oembed.url);

  return lines.join("\n");
}
