import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Web Share Target may send data via query params or form data
    const { searchParams } = request.nextUrl;

    console.log("Share POST received:", {
      url: request.url,
      searchParams: Object.fromEntries(searchParams.entries()),
      contentType: request.headers.get("content-type"),
    });

    // Try to get data from query params first (Chrome Android behavior)
    let url = searchParams.get("url") || "";
    let title = searchParams.get("title") || "";
    let text = searchParams.get("text") || "";

    // If not in query params, try form data
    if (!url && !title && !text) {
      const formData = await request.formData();
      const urlForm = formData.get("url")?.toString() || "";
      const titleForm = formData.get("title")?.toString() || "";
      const textForm = formData.get("text")?.toString() || "";

      if (urlForm) url = urlForm;
      if (titleForm) title = titleForm;
      if (textForm) text = textForm;
    }

    // Sometimes the URL comes in the 'text' field instead of 'url'
    if (!url && text) {
      // Check if text looks like a URL
      try {
        new URL(text);
        url = text;
        text = "";
      } catch {
        // text is not a URL, keep it as is
      }
    }

    // Redirect to the share page with query params
    // Use nextUrl.clone() for better compatibility with Cloudflare Workers
    const shareUrl = request.nextUrl.clone();
    shareUrl.pathname = "/share";
    shareUrl.search = ""; // Clear existing query params

    if (url) shareUrl.searchParams.set("url", url);
    if (title) shareUrl.searchParams.set("title", title);
    if (text) shareUrl.searchParams.set("text", text);

    return NextResponse.redirect(shareUrl);
  } catch (error) {
    console.error("Share POST error:", error);
    // Fallback to share page without params
    const fallbackUrl = request.nextUrl.clone();
    fallbackUrl.pathname = "/share";
    fallbackUrl.search = "";
    return NextResponse.redirect(fallbackUrl);
  }
}
