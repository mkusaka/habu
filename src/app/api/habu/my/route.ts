import { NextRequest, NextResponse } from "next/server";
import { createSignedRequest } from "@/lib/hatena-oauth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createAuth } from "@/lib/auth";

const HATENA_MY_API_URL = "https://bookmark.hatenaapis.com/rest/1/my";

interface HatenaMyResponse {
  name: string;
  plususer: boolean;
  private: boolean;
  is_oauth_twitter: boolean;
  is_oauth_evernote: boolean;
  is_oauth_facebook: boolean;
  is_oauth_mixi_check: boolean;
}

export interface MyResponse {
  success: boolean;
  error?: string;
  username?: string;
  isPlusUser?: boolean;
}

/**
 * Get authenticated user's Hatena info
 * GET /api/habu/my
 */
export async function GET(request: NextRequest) {
  try {
    // Get DB connection for auth
    const { env } = getCloudflareContext();
    const auth = createAuth(env.DB);

    // Get current user session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Not authenticated" } as MyResponse, {
        status: 401,
      });
    }

    // Get user with hatenaToken relation
    const db = getDb(env.DB);

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      with: { hatenaToken: true },
    });

    if (!user?.hatenaToken) {
      return NextResponse.json(
        { success: false, error: "Hatena not connected" } as MyResponse,
        { status: 400 },
      );
    }

    const { accessToken: hatenaAccessToken, accessTokenSecret: hatenaAccessTokenSecret } = user.hatenaToken;

    // Get consumer credentials from env
    const consumerKey = env.HATENA_CONSUMER_KEY;
    const consumerSecret = env.HATENA_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" } as MyResponse,
        { status: 500 },
      );
    }

    // Create OAuth signed request
    const authHeaders = createSignedRequest(
      HATENA_MY_API_URL,
      "GET",
      hatenaAccessToken,
      hatenaAccessTokenSecret,
      consumerKey,
      consumerSecret,
    );

    const response = await fetch(HATENA_MY_API_URL, {
      method: "GET",
      headers: authHeaders,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `Hatena API error: ${response.status} - ${errorText}` } as MyResponse,
        { status: response.status },
      );
    }

    const data = (await response.json()) as HatenaMyResponse;

    return NextResponse.json({
      success: true,
      username: data.name,
      isPlusUser: data.plususer,
    } as MyResponse);
  } catch (error) {
    console.error("My API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      } as MyResponse,
      { status: 500 },
    );
  }
}
