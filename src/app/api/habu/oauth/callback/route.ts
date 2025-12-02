import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/hatena-oauth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db/client";
import { hatenaTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createAuth } from "@/lib/auth";
import CryptoJS from "crypto-js";

// Decrypt OAuth state
function decryptOAuthState(
  encrypted: string,
  secret: string,
): { token: string; tokenSecret: string; returnTo?: string } | null {
  try {
    const decrypted = CryptoJS.AES.decrypt(encrypted, secret).toString(CryptoJS.enc.Utf8);
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
      return NextResponse.redirect(new URL("/settings?error=missing_params", request.url));
    }

    // Get encrypted OAuth state from cookie
    const encryptedState = request.cookies.get("habu_oauth_state")?.value;

    if (!encryptedState) {
      return NextResponse.redirect(new URL("/settings?error=state_missing", request.url));
    }

    // Get env for secrets
    const { env } = getCloudflareContext();

    // Get credentials from env
    const consumerKey = env.HATENA_CONSUMER_KEY;
    const consumerSecret = env.HATENA_CONSUMER_SECRET;
    const authSecret = env.BETTER_AUTH_SECRET;

    if (!consumerKey || !consumerSecret) {
      console.error("Missing HATENA_CONSUMER_KEY or HATENA_CONSUMER_SECRET in env");
      return NextResponse.redirect(new URL("/settings?error=config_error", request.url));
    }

    if (!authSecret) {
      console.error("Missing BETTER_AUTH_SECRET in env");
      return NextResponse.redirect(new URL("/settings?error=config_error", request.url));
    }

    // Decrypt OAuth state
    const oauthState = decryptOAuthState(encryptedState, authSecret);

    if (!oauthState) {
      return NextResponse.redirect(new URL("/settings?error=state_invalid", request.url));
    }

    const { token: storedToken, tokenSecret, returnTo = "/settings" } = oauthState;

    // Verify that the callback token matches the request token we initiated
    // This prevents token fixation attacks
    if (oauthToken !== storedToken) {
      return NextResponse.redirect(new URL("/settings?error=token_mismatch", request.url));
    }

    // Exchange for access token
    const { accessToken, accessTokenSecret } = await getAccessToken(
      oauthToken,
      tokenSecret,
      oauthVerifier,
      consumerKey,
      consumerSecret,
    );
    const auth = createAuth(env.DB);

    // Get current user session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.redirect(new URL("/settings?error=not_authenticated", request.url));
    }

    // Store Hatena tokens in database
    const db = getDb(env.DB);

    // Check if user already has tokens (upsert)
    const existing = await db
      .select()
      .from(hatenaTokens)
      .where(eq(hatenaTokens.userId, session.user.id))
      .get();

    console.log("[oauth/callback] userId:", session.user.id);
    console.log("[oauth/callback] existing tokens:", existing ? "yes" : "no");

    if (existing) {
      // Update existing tokens
      console.log("[oauth/callback] Updating existing tokens with read_private scope");
      await db
        .update(hatenaTokens)
        .set({
          accessToken,
          accessTokenSecret,
          scope: "read_public,read_private,write_public",
          updatedAt: new Date(),
        })
        .where(eq(hatenaTokens.userId, session.user.id));
    } else {
      // Insert new tokens
      console.log("[oauth/callback] Inserting new tokens with read_private scope");
      await db.insert(hatenaTokens).values({
        userId: session.user.id,
        accessToken,
        accessTokenSecret,
        scope: "read_public,read_private,write_public",
      });
    }

    // Clear OAuth state cookie and redirect to return URL
    const response = NextResponse.redirect(
      new URL(`${returnTo}?success=hatena_connected`, request.url),
    );
    response.cookies.delete("habu_oauth_state");

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL("/settings?error=oauth_failed", request.url));
  }
}
