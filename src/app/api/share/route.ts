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
      try {
        new URL(text);
        url = text;
        text = "";
      } catch {
        // text is not a URL, keep it as is
      }
    }

    // Redirect to the root page with query params
    const shareUrl = request.nextUrl.clone();
    shareUrl.pathname = "/";
    shareUrl.search = "";

    if (url) shareUrl.searchParams.set("url", url);
    if (title) shareUrl.searchParams.set("title", title);
    if (text) shareUrl.searchParams.set("text", text);

    return NextResponse.redirect(shareUrl, 303);
  } catch (error) {
    console.error("Share POST error:", error);
    const fallbackUrl = request.nextUrl.clone();
    fallbackUrl.pathname = "/";
    fallbackUrl.search = "";
    return NextResponse.redirect(fallbackUrl, 303);
  }
}
