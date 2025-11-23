import { NextRequest, NextResponse } from "next/server";
import { getRequestToken, getAuthorizeUrl } from "@/lib/hatena-oauth";
import CryptoJS from "crypto-js";

const OAUTH_STATE_SECRET = process.env.BETTER_AUTH_SECRET || "change-this-secret-in-production";

// Encrypt OAuth state to prevent token fixation attacks
function encryptOAuthState(data: { token: string; tokenSecret: string }): string {
  return CryptoJS.AES.encrypt(JSON.stringify(data), OAUTH_STATE_SECRET).toString();
}

export async function GET(request: NextRequest) {
  try {
    // Get the callback URL
    const baseUrl = new URL(request.url).origin;
    const callbackUrl = `${baseUrl}/api/habu/oauth/callback`;

    // Get request token from Hatena
    const { token, tokenSecret } = await getRequestToken(callbackUrl);

    // Encrypt and store OAuth state in httpOnly cookie
    const encryptedState = encryptOAuthState({ token, tokenSecret });

    const response = NextResponse.redirect(getAuthorizeUrl(token));

    response.cookies.set("habu_oauth_state", encryptedState, {
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
