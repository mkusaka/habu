import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db/client";
import { hatenaTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createAuth } from "@/lib/auth";

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
      return NextResponse.json({
        authenticated: false,
        hasHatena: false,
      });
    }

    // Check if user has Hatena tokens in database
    const db = getDb(env.DB);

    const tokens = await db
      .select()
      .from(hatenaTokens)
      .where(eq(hatenaTokens.userId, session.user.id))
      .get();

    return NextResponse.json({
      authenticated: true,
      hasHatena: !!tokens,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json({ authenticated: false, hasHatena: false }, { status: 500 });
  }
}
