import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { hatenaTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertCircle, Home, ExternalLink } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { OAuthButton } from "@/components/ui/oauth-button";
import { ActionButton } from "@/components/ui/action-button";
import { AutoSaveToggle } from "@/components/auto-save-toggle";
import { ToastHandler } from "./toast-handler";
import { disconnectHatena } from "./actions";

interface SettingsContentProps {
  searchParams: Promise<{ error?: string; success?: string }>;
}

async function SettingsContent({ searchParams }: SettingsContentProps) {
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
    const tokens = await db
      .select()
      .from(hatenaTokens)
      .where(eq(hatenaTokens.userId, session.user.id))
      .get();

    hasHatena = !!tokens;
  }

  return (
    <>
      <ToastHandler error={params.error} success={params.success} />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Settings</CardTitle>
            <LinkButton variant="ghost" size="icon" href="/">
              <Home className="w-5 h-5" />
            </LinkButton>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Hatena Connection */}
          <div>
            <h3 className="text-sm font-medium mb-2">Hatena Bookmark</h3>
            <div className="flex items-center gap-2 mb-3">
              {hasHatena ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm">Connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm">Not connected</span>
                </>
              )}
            </div>
            {!hasHatena && (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  Connect your Hatena account to save bookmarks.
                </p>
                <OAuthButton url="/api/habu/oauth/start" size="sm">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Connect Hatena
                </OAuthButton>
              </>
            )}
            {hasHatena && (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  Your Hatena account is connected. You can now save bookmarks!
                </p>
                <div className="flex gap-2">
                  <OAuthButton url="/api/habu/oauth/start" variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Reconnect
                  </OAuthButton>
                  <ActionButton action={disconnectHatena} variant="destructive" size="sm">
                    Disconnect
                  </ActionButton>
                </div>
              </>
            )}
          </div>

          <Separator />

          {/* Auto-save Setting */}
          <div>
            <h3 className="text-sm font-medium mb-3">Preferences</h3>
            <AutoSaveToggle />
          </div>

          <Separator />

          {/* App Info */}
          <div>
            <h3 className="text-sm font-medium mb-2">About</h3>
            <p className="text-sm text-muted-foreground">
              habu is a PWA for quickly saving bookmarks to Hatena Bookmark.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

interface SettingsPageProps {
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default function SettingsPage({ searchParams }: SettingsPageProps) {
  return <SettingsContent searchParams={searchParams} />;
}
