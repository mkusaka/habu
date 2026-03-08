import { fetchTwitterMarkdown } from "./twitter-content";
import { isTwitterStatusUrl } from "./twitter-oembed";

const DEFAULT_MAX_MARKDOWN_CHARS = 50000;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 2;

export type PageMarkdownSource = "twitter-x-api" | "twitter-grok" | "twitter-oembed" | "cloudflare";

interface FetchPageMarkdownOptions {
  cfAccountId?: string;
  cfApiToken?: string;
  maxChars?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

interface FetchPageMarkdownResult {
  markdown: string;
  error?: string;
  source?: PageMarkdownSource;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  }: FetchPageMarkdownOptions = {},
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithTimeout(url, options, timeoutMs);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.name !== "AbortError" && !lastError.message.includes("fetch")) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error("Fetch failed after retries");
}

function isTwitterInterstitialMarkdown(markdown: string): boolean {
  return (
    markdown.includes("Something went wrong") ||
    (markdown.includes("Try again") && markdown.includes("x.com")) ||
    markdown.includes("Some privacy related extensions may cause issues on x.com")
  );
}

async function fetchTwitterMarkdownOrNull(
  url: string,
  maxChars: number,
): Promise<FetchPageMarkdownResult | null> {
  try {
    const twitter = await fetchTwitterMarkdown(url);
    if (!twitter?.markdown) {
      return null;
    }

    const source =
      twitter.source === "x-api"
        ? "twitter-x-api"
        : twitter.source === "grok"
          ? "twitter-grok"
          : "twitter-oembed";

    return {
      markdown: twitter.markdown.slice(0, maxChars),
      source,
    };
  } catch {
    return null;
  }
}

export function isUrlSafeToFetch(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { valid: false, error: "Only http/https URLs are allowed" };
    }

    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return { valid: false, error: "Private/localhost URLs are not allowed" };
    }

    if (
      hostname === "::1" ||
      hostname.startsWith("fc") ||
      hostname.startsWith("fd") ||
      hostname.startsWith("fe80") ||
      hostname.startsWith("::ffff:127.") ||
      hostname.startsWith("::ffff:10.") ||
      hostname.startsWith("::ffff:192.168.") ||
      hostname.startsWith("::ffff:172.")
    ) {
      return { valid: false, error: "Private/localhost IPv6 addresses are not allowed" };
    }

    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number);
      if (
        a === 10 ||
        a === 127 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 169 && b === 254)
      ) {
        return { valid: false, error: "Private IP addresses are not allowed" };
      }
    }

    if (urlString.length > 2048) {
      return { valid: false, error: "URL is too long" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

export async function fetchPageMarkdown(
  url: string,
  options: FetchPageMarkdownOptions,
): Promise<FetchPageMarkdownResult> {
  const maxChars = options.maxChars ?? DEFAULT_MAX_MARKDOWN_CHARS;

  if (isTwitterStatusUrl(url)) {
    const twitterResult = await fetchTwitterMarkdownOrNull(url, maxChars);
    if (twitterResult) {
      return twitterResult;
    }
  }

  if (!options.cfAccountId || !options.cfApiToken) {
    return { markdown: "", error: "Browser Rendering is not configured" };
  }

  try {
    const response = await fetchWithRetry(
      `https://api.cloudflare.com/client/v4/accounts/${options.cfAccountId}/browser-rendering/markdown`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.cfApiToken}`,
        },
        body: JSON.stringify({ url }),
      },
      options,
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { markdown: "", error: `HTTP ${response.status}: ${errorText.slice(0, 200)}` };
    }

    const data = (await response.json()) as {
      success: boolean;
      result?: string;
      errors?: unknown[];
    };

    if (!data.success || !data.result) {
      return {
        markdown: "",
        error: `API error: ${data.errors ? JSON.stringify(data.errors) : "Unknown error"}`,
      };
    }

    const markdown = data.result.slice(0, maxChars);
    if (isTwitterStatusUrl(url) && isTwitterInterstitialMarkdown(markdown)) {
      const twitterResult = await fetchTwitterMarkdownOrNull(url, maxChars);
      if (twitterResult) {
        return twitterResult;
      }
      return { markdown: "", error: "X returned an interstitial error page" };
    }

    return {
      markdown,
      source: "cloudflare",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        markdown: "",
        error: "Request timed out after retries. The page may be slow to respond.",
      };
    }
    return {
      markdown: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
