import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { createSignedRequest } from "@/lib/hatena-oauth";
import type { HatenaTagsListResponse, HatenaTagsResponse } from "@/types/habu";

const HATENA_TAGS_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/tags";

export async function GET(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const auth = createAuth(env.DB);

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" } as HatenaTagsListResponse,
        { status: 401 },
      );
    }

    const db = getDb(env.DB);
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      with: { hatenaToken: true },
    });

    if (!user?.hatenaToken) {
      return NextResponse.json(
        { success: false, error: "Hatena not connected" } as HatenaTagsListResponse,
        { status: 400 },
      );
    }

    const consumerKey = env.HATENA_CONSUMER_KEY;
    const consumerSecret = env.HATENA_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" } as HatenaTagsListResponse,
        { status: 500 },
      );
    }

    const authHeaders = createSignedRequest(
      HATENA_TAGS_API_URL,
      "GET",
      user.hatenaToken.accessToken,
      user.hatenaToken.accessTokenSecret,
      consumerKey,
      consumerSecret,
    );

    const response = await fetch(HATENA_TAGS_API_URL, {
      method: "GET",
      headers: authHeaders,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      return NextResponse.json(
        {
          success: false,
          error: `Hatena Tags API redirect detected: ${response.status} -> ${location}`,
        } as HatenaTagsListResponse,
        { status: 502 },
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          success: false,
          error: `Hatena Tags API error: ${response.status} - ${errorText}`,
        } as HatenaTagsListResponse,
        { status: response.status },
      );
    }

    const data = (await response.json()) as HatenaTagsResponse;
    const tags = [...data.tags].sort(
      (a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ja"),
    );

    return NextResponse.json({ success: true, tags } as HatenaTagsListResponse);
  } catch (error) {
    console.error("Hatena tags API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      } as HatenaTagsListResponse,
      { status: 500 },
    );
  }
}
