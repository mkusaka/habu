import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/hatena-oauth";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const oauthToken = searchParams.get("oauth_token");
    const oauthVerifier = searchParams.get("oauth_verifier");

    if (!oauthToken || !oauthVerifier) {
      return NextResponse.redirect(
        new URL("/settings?error=missing_params", request.url)
      );
    }

    // Get the stored token secret from cookie
    const tokenSecret = request.cookies.get("hatena_oauth_secret")?.value;
    if (!tokenSecret) {
      return NextResponse.redirect(
        new URL("/settings?error=missing_secret", request.url)
      );
    }

    // Exchange for access token
    const { accessToken, accessTokenSecret } = await getAccessToken(
      oauthToken,
      tokenSecret,
      oauthVerifier
    );

    // Store Hatena tokens in cookies (stateless approach)
    // In Better Auth stateless mode without DB, we store tokens separately
    const response = NextResponse.redirect(
      new URL("/settings?success=hatena_connected", request.url)
    );

    // Store Hatena tokens as secure httpOnly cookies
    response.cookies.set("hatena_access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });

    response.cookies.set("hatena_access_token_secret", accessTokenSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });

    // Clear the temporary OAuth secret cookie
    response.cookies.delete("hatena_oauth_secret");

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/settings?error=oauth_failed", request.url)
    );
  }
}
