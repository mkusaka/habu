import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/hatena-oauth";
import CryptoJS from "crypto-js";

const OAUTH_STATE_SECRET = process.env.BETTER_AUTH_SECRET || "change-this-secret-in-production";

// Decrypt OAuth state
function decryptOAuthState(encrypted: string): { token: string; tokenSecret: string } | null {
  try {
    const decrypted = CryptoJS.AES.decrypt(encrypted, OAUTH_STATE_SECRET).toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

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

    // Get encrypted OAuth state from cookie
    const encryptedState = request.cookies.get("habu_oauth_state")?.value;

    if (!encryptedState) {
      return NextResponse.redirect(
        new URL("/settings?error=state_missing", request.url)
      );
    }

    // Decrypt OAuth state
    const oauthState = decryptOAuthState(encryptedState);

    if (!oauthState) {
      return NextResponse.redirect(
        new URL("/settings?error=state_invalid", request.url)
      );
    }

    const { token: storedToken, tokenSecret } = oauthState;

    // Verify that the callback token matches the request token we initiated
    // This prevents token fixation attacks
    if (oauthToken !== storedToken) {
      return NextResponse.redirect(
        new URL("/settings?error=token_mismatch", request.url)
      );
    }

    // Exchange for access token
    const { accessToken, accessTokenSecret } = await getAccessToken(
      oauthToken,
      tokenSecret,
      oauthVerifier
    );

    // Store Hatena tokens as secure httpOnly cookies
    // Token lifetime reduced to 30 days for better security
    const response = NextResponse.redirect(
      new URL("/settings?success=hatena_connected", request.url)
    );

    response.cookies.set("hatena_access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    response.cookies.set("hatena_access_token_secret", accessTokenSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    // Clear OAuth state cookie
    response.cookies.delete("habu_oauth_state");

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/settings?error=oauth_failed", request.url)
    );
  }
}
