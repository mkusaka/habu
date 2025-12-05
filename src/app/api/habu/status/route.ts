import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
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

    const db = getDb(env.DB);
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    return NextResponse.json({
      authenticated: true,
      hasHatena: !!user?.hatenaId,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json({ authenticated: false, hasHatena: false }, { status: 500 });
  }
}
