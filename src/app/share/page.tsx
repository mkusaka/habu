import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { hatenaTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ShareForm } from "./share-form";

interface SharePageProps {
  searchParams: Promise<{ url?: string; title?: string; text?: string }>;
}

export default async function SharePage({ searchParams }: SharePageProps) {
  const params = await searchParams;

  // Check Hatena connection status
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
    const tokens = await db
      .select()
      .from(hatenaTokens)
      .where(eq(hatenaTokens.userId, session.user.id))
      .get();

    hasHatena = !!tokens;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <ShareForm
        initialUrl={params.url || ""}
        initialTitle={params.title || ""}
        initialComment={params.text || ""}
        hasHatena={hasHatena}
      />
    </div>
  );
}
