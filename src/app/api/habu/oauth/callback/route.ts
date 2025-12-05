import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, fetchHatenaUserInfo } from "@/lib/hatena-oauth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db/client";
import { hatenaTokens, users } from "@/db/schema";
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

    // Debug logging for token comparison
    console.log("[oauth/callback] oauth_token from URL:", oauthToken);
    console.log("[oauth/callback] storedToken from cookie:", storedToken);
    console.log("[oauth/callback] tokens match:", oauthToken === storedToken);

    // Verify that the callback token matches the request token we initiated
    // This prevents token fixation attacks
    if (oauthToken !== storedToken) {
      console.error("[oauth/callback] Token mismatch! URL:", oauthToken, "Cookie:", storedToken);
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

    // Log token info for debugging (masked)
    console.log("[oauth/callback] Got access token:", accessToken?.substring(0, 10) + "...");
    console.log("[oauth/callback] Token length:", accessToken?.length);
    console.log("[oauth/callback] Token contains special chars:", /[+/=]/.test(accessToken || ""));

    // Fetch Hatena user info to get hatenaId
    const { hatenaId, displayName } = await fetchHatenaUserInfo(
      accessToken,
      accessTokenSecret,
      consumerKey,
      consumerSecret,
    );
    console.log("[oauth/callback] Hatena ID:", hatenaId);
    console.log("[oauth/callback] Hatena display name:", displayName);

    const auth = createAuth(env.DB);
    const db = getDb(env.DB);

    // Get current user session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.redirect(new URL("/settings?error=not_authenticated", request.url));
    }

    // Update current user with hatenaId and mark as non-anonymous
    console.log("[oauth/callback] Updating user:", session.user.id, "with hatenaId:", hatenaId);
    await db
      .update(users)
      .set({
        hatenaId,
        name: displayName || session.user.name,
        isAnonymous: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    // Store Hatena tokens in database (upsert by hatenaId)
    console.log("[oauth/callback] Upserting tokens for hatenaId:", hatenaId);
    await db
      .insert(hatenaTokens)
      .values({
        hatenaId,
        accessToken,
        accessTokenSecret,
        scope: "read_public,read_private,write_public",
      })
      .onConflictDoUpdate({
        target: hatenaTokens.hatenaId,
        set: {
          accessToken,
          accessTokenSecret,
          scope: "read_public,read_private,write_public",
          updatedAt: new Date(),
        },
      });
    console.log("[oauth/callback] Token saved successfully");

    // Clear OAuth state cookie and redirect to return URL
    const response = NextResponse.redirect(
      new URL(`${returnTo}?success=hatena_connected`, request.url),
    );
    response.cookies.delete("habu_oauth_state");

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);

    // Check for specific OAuth errors
    const errorMessage = error instanceof Error ? error.message : "";
    if (errorMessage.includes("verifier_invalid")) {
      return NextResponse.redirect(new URL("/settings?error=verifier_invalid", request.url));
    }
    if (errorMessage.includes("token_rejected")) {
      return NextResponse.redirect(new URL("/settings?error=token_rejected", request.url));
    }

    return NextResponse.redirect(new URL("/settings?error=oauth_failed", request.url));
  }
}
