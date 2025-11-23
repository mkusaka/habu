import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/hatena-oauth";
import { auth } from "@/lib/auth";

export const runtime = "edge";

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

    // Get current session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.redirect(
        new URL("/settings?error=not_authenticated", request.url)
      );
    }

    // Update user session with Hatena tokens
    // In Better Auth stateless mode, we need to update the session payload
    // This is done by calling the updateUser method which will re-issue the token
    await auth.api.updateUser({
      headers: request.headers,
      body: {
        userId: session.user.id,
        // Add Hatena tokens to user metadata
        data: {
          hatenaAccessToken: accessToken,
          hatenaAccessTokenSecret: accessTokenSecret,
        },
      },
    });

    // Redirect to settings with success
    const response = NextResponse.redirect(
      new URL("/settings?success=hatena_connected", request.url)
    );

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
