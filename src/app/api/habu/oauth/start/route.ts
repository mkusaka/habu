import { NextRequest, NextResponse } from "next/server";
import { getRequestToken, getAuthorizeUrl } from "@/lib/hatena-oauth";
import { getHabuSession } from "@/lib/auth";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    // Get the callback URL
    const baseUrl = new URL(request.url).origin;
    const callbackUrl = `${baseUrl}/api/habu/oauth/callback`;

    // Get request token from Hatena
    const { token, tokenSecret } = await getRequestToken(callbackUrl);

    // Store token secret in a cookie (we'll need it for the callback)
    const response = NextResponse.redirect(getAuthorizeUrl(token));

    // Store the request token secret in a secure, httpOnly cookie
    response.cookies.set("hatena_oauth_secret", tokenSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("OAuth start error:", error);
    return NextResponse.json(
      { error: "Failed to start OAuth flow" },
      { status: 500 }
    );
  }
}
