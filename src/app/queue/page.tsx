import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Settings } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { SyncButton } from "./sync-button";
import { QueueStats, QueueList, ClearCompletedButton } from "./queue-list";

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

export default async function QueuePage() {
  const hasHatena = await getHatenaStatus();

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Bookmark Queue</CardTitle>
            <LinkButton href="/" variant="ghost" size="icon">
              <Home className="w-5 h-5" />
            </LinkButton>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sync controls */}
          <div className="flex gap-2">
            <SyncButton />
            <ClearCompletedButton />
          </div>

          {/* Stats */}
          <QueueStats />

          {/* Connect to Hatena (only when not connected) */}
          {!hasHatena && (
            <LinkButton href="/settings" variant="outline" size="sm" className="w-full">
              <Settings className="w-4 h-4 mr-2" />
              Connect to Hatena Bookmark
            </LinkButton>
          )}
        </CardContent>
      </Card>

      {/* Queue items */}
      <QueueList />
    </div>
  );
}
