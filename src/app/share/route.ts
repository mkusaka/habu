import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    // Web Share Target sends data as application/x-www-form-urlencoded
    const formData = await request.formData();

    const url = formData.get("url")?.toString() || "";
    const title = formData.get("title")?.toString() || "";
    const text = formData.get("text")?.toString() || "";

    // Redirect to the share page with query params
    const shareUrl = new URL("/share", request.url);
    if (url) shareUrl.searchParams.set("url", url);
    if (title) shareUrl.searchParams.set("title", title);
    if (text) shareUrl.searchParams.set("text", text);

    return NextResponse.redirect(shareUrl);
  } catch (error) {
    console.error("Share POST error:", error);
    // Fallback to share page without params
    return NextResponse.redirect(new URL("/share", request.url));
  }
}
