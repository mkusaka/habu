import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Settings } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

async function getHatenaStatus(): Promise<boolean> {
  const cookieStore = await cookies();
  const { env } = getCloudflareContext();
  const auth = createAuth(env.DB);

  const session = await auth.api.getSession({
    headers: {
      cookie: cookieStore.toString(),
    },
  });

  if (!session?.user) {
    return false;
  }

  const db = getDb(env.DB);
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  return !!user?.hatenaId;
}

export default async function SavedPage() {
  const hasHatena = await getHatenaStatus();

  return (
    <Card className="w-full text-center">
      <CardHeader>
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="w-16 h-16 text-green-500" />
        </div>
        <CardTitle>Bookmark Saved!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Your bookmark has been added to the queue and will be synced to Hatena Bookmark.
        </p>
        <div className="flex flex-col gap-2">
          <LinkButton href="/queue">View Queue</LinkButton>
          <LinkButton href="/" variant="outline">
            Go Home
          </LinkButton>
          {!hasHatena && (
            <LinkButton href="/settings" variant="ghost" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Connect to Hatena
            </LinkButton>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
