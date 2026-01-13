import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, Home, Settings } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { SyncButton } from "./sync-button";
import { QueueStats, QueueList, ClearCompletedButton, CopyAllUrlsButton } from "./queue-list";

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
    <Card className="w-full h-full max-h-full overflow-hidden">
      <CardHeader className="pb-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ListTodo className="w-6 h-6 text-primary" />
            <CardTitle className="text-xl">Bookmark Queue</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <SyncButton />
            <LinkButton href="/" variant="ghost" size="icon">
              <Home className="w-5 h-5" />
            </LinkButton>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 min-h-0 flex-col gap-4">
        {/* Stats */}
        <QueueStats />

        {/* Connect to Hatena (only when not connected) */}
        {!hasHatena && (
          <LinkButton href="/settings" variant="outline" size="sm" className="w-full">
            <Settings className="w-4 h-4 mr-2" />
            Connect to Hatena Bookmark
          </LinkButton>
        )}

        {/* Queue items */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="h-full overflow-auto">
            <QueueList />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap shrink-0">
          <CopyAllUrlsButton />
          <ClearCompletedButton />
        </div>
      </CardContent>
    </Card>
  );
}
