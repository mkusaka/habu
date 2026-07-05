import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getSessionWithRecovery } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";

export async function getHatenaConnectionStatus(): Promise<boolean> {
  const cookieStore = await cookies();
  const { env, ctx } = getCloudflareContext();

  const session = await getSessionWithRecovery(env.DB, { cookie: cookieStore.toString() }, ctx);

  if (!session?.user) {
    return false;
  }

  const db = getDb(env.DB);
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  return !!user?.hatenaId;
}
