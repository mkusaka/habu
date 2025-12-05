"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { hatenaTokens, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function disconnectHatena() {
  const cookieStore = await cookies();
  const { env } = getCloudflareContext();
  const auth = createAuth(env.DB);

  const session = await auth.api.getSession({
    headers: {
      cookie: cookieStore.toString(),
    },
  });

  if (!session?.user) {
    redirect("/settings?error=not_authenticated");
  }

  const db = getDb(env.DB);

  // Get user with hatenaToken relation
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    with: { hatenaToken: true },
  });

  if (user?.hatenaToken) {
    // Delete Hatena tokens by hatenaId
    await db.delete(hatenaTokens).where(eq(hatenaTokens.hatenaId, user.hatenaToken.hatenaId));

    // Clear hatenaId from user
    await db
      .update(users)
      .set({ hatenaId: null, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));
  }

  redirect("/settings?success=hatena_disconnected");
}
