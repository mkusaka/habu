import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
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
  const { env } = getCloudflareContext();
  const auth = createAuth(env.DB);

  const session = await auth.api.getSession({
    headers: {
      cookie: cookieStore.toString(),
    },
  });

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
