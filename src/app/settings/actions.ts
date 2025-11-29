"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { hatenaTokens } from "@/db/schema";
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

  // Delete Hatena tokens from database
  const db = getDb(env.DB);
  await db.delete(hatenaTokens).where(eq(hatenaTokens.userId, session.user.id));

  redirect("/settings?success=hatena_disconnected");
}
