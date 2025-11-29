import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { hatenaTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bookmark, List, Settings, Plus, ExternalLink } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { OAuthButton } from "@/components/ui/oauth-button";

export default async function Home() {
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
    const tokens = await db
      .select()
      .from(hatenaTokens)
      .where(eq(hatenaTokens.userId, session.user.id))
      .get();

    hasHatena = !!tokens;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Bookmark className="w-16 h-16 text-primary" />
            </div>
            <CardTitle className="text-2xl">habu</CardTitle>
            <p className="text-sm text-muted-foreground">
              Quick bookmark saving to Hatena Bookmark
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {!hasHatena && (
              <OAuthButton url="/api/habu/oauth/start" className="w-full" size="lg">
                <ExternalLink className="w-5 h-5 mr-2" />
                Connect Hatena
              </OAuthButton>
            )}
            <LinkButton
              href="/share"
              className="w-full"
              size="lg"
              disabled={!hasHatena}
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Bookmark
            </LinkButton>
            <LinkButton
              href="/queue"
              variant="outline"
              className="w-full"
              size="lg"
              disabled={!hasHatena}
            >
              <List className="w-5 h-5 mr-2" />
              View Queue
            </LinkButton>
            <LinkButton
              href="/settings"
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Settings className="w-5 h-5 mr-2" />
              Settings
            </LinkButton>

            <div className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">
                {hasHatena
                  ? "Share any page to habu for quick bookmarking!"
                  : "Connect your Hatena account to start bookmarking"}
              </p>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
