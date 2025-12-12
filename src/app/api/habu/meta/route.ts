import { NextRequest, NextResponse } from "next/server";
import { fetchPageMeta, isMetaExtractionResult } from "@/lib/page-meta";

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

  try {
    const result = await fetchPageMeta(url);

    if (!isMetaExtractionResult(result)) {
      return NextResponse.json({ error: "URL does not return HTML" }, { status: 400 });
    }

    const meta: MetaResponse = {
      title: result.og.title || result.twitter.title || result.title || undefined,
      description:
        result.og.description || result.twitter.description || result.description || undefined,
      image: result.og.image || result.twitter.image || undefined,
    };

    return NextResponse.json(meta);
  } catch (error) {
    console.error("Meta fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch page metadata" }, { status: 500 });
  }
}
