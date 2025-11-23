import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Web Share Target may send data via query params
    const { searchParams } = request.nextUrl;

    console.log("Share POST received at /share:", {
      url: request.url,
      searchParams: Object.fromEntries(searchParams.entries()),
      contentType: request.headers.get("content-type"),
    });

    let url = searchParams.get("url") || "";
    const title = searchParams.get("title") || "";
    let text = searchParams.get("text") || "";

    // Sometimes the URL comes in the 'text' field instead of 'url'
    if (!url && text) {
      try {
        new URL(text);
        url = text;
        text = "";
      } catch {
        // text is not a URL, keep it as is
      }
    }

    // Redirect to GET with clean params
    const shareUrl = request.nextUrl.clone();
    shareUrl.search = ""; // Clear existing query params

    if (url) shareUrl.searchParams.set("url", url);
    if (title) shareUrl.searchParams.set("title", title);
    if (text) shareUrl.searchParams.set("text", text);

    return NextResponse.redirect(shareUrl, 303);
  } catch (error) {
    console.error("Share POST error:", error);
    // Fallback to share page without params
    const fallbackUrl = request.nextUrl.clone();
    fallbackUrl.pathname = "/share";
    fallbackUrl.search = "";
    return NextResponse.redirect(fallbackUrl, 303);
  }
}
