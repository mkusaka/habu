import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionWithRecovery } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SaveForm } from "@/components/save-form";

interface HomeProps {
  searchParams: Promise<{ url?: string; title?: string; text?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;

  // Check Hatena connection status on server
  const cookieStore = await cookies();
  const { env, ctx } = getCloudflareContext();

  const session = await getSessionWithRecovery(env.DB, { cookie: cookieStore.toString() }, ctx);

  let hasHatena = false;

  if (session?.user) {
    const db = getDb(env.DB);
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });
    hasHatena = !!user?.hatenaId;
  }

  return (
    <SaveForm
      initialUrl={params.url || ""}
      initialTitle={params.title || ""}
      initialComment={params.text || ""}
      hasHatena={hasHatena}
    />
  );
}
