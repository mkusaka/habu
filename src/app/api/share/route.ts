import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Web Share Target sends data as application/x-www-form-urlencoded
    const formData = await request.formData();

    let url = formData.get("url")?.toString() || "";
    const title = formData.get("title")?.toString() || "";
    let text = formData.get("text")?.toString() || "";

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
