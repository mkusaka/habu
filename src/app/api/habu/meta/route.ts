import { NextRequest, NextResponse } from "next/server";

interface MetaResponse {
  title?: string;
  description?: string;
  image?: string;
}

/**
 * Fetch page metadata (title, description, og:image) from a URL
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; habu/1.0; +https://habu.polyfill.workers.dev)",
        Accept: "text/html",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status}` },
        { status: 502 },
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json(
        { error: "URL does not return HTML" },
        { status: 400 },
      );
    }

    const html = await response.text();
    const meta = parseMetaTags(html);

    return NextResponse.json(meta);
  } catch (error) {
    console.error("Meta fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch page metadata" },
      { status: 500 },
    );
  }
}

/**
 * Parse HTML to extract meta tags
 */
function parseMetaTags(html: string): MetaResponse {
  const result: MetaResponse = {};

  // Extract og:title or title
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  result.title = ogTitleMatch?.[1] || titleMatch?.[1] || undefined;
  if (result.title) {
    result.title = decodeHtmlEntities(result.title.trim());
  }

  // Extract og:description or meta description
  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

  result.description = ogDescMatch?.[1] || descMatch?.[1] || undefined;
  if (result.description) {
    result.description = decodeHtmlEntities(result.description.trim());
  }

  // Extract og:image
  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

  result.image = ogImageMatch?.[1] || undefined;

  return result;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
