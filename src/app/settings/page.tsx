import { Suspense } from "react";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertCircle, Home, ExternalLink } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { OAuthButton } from "@/components/ui/oauth-button";
import { ActionButton } from "@/components/ui/action-button";
import { AutoSaveToggle } from "@/components/auto-save-toggle";
import { AiGenerateToggle } from "@/components/ai-generate-toggle";
import { NotificationToggle } from "@/components/notification-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
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
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });
    hasHatena = !!user?.hatenaId;
  }

  return (
    <div className="w-full py-8">
      <ToastHandler error={params.error} success={params.success} />
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <LinkButton variant="ghost" size="icon" href="/">
          <Home className="w-5 h-5" />
        </LinkButton>
      </header>
      <div className="space-y-8">
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

        {/* Preferences */}
        <div>
          <h3 className="text-sm font-medium mb-3">Preferences</h3>
          <div className="space-y-4">
            <ThemeToggle />
            <AutoSaveToggle />
            <AiGenerateToggle />
            <NotificationToggle />
          </div>
        </div>

        <Separator />

        {/* App Info */}
        <div>
          <h3 className="text-sm font-medium mb-2">About</h3>
          <p className="text-sm text-muted-foreground">
            habu is a PWA for quickly saving bookmarks to Hatena Bookmark.
          </p>
        </div>
      </div>
    </div>
  );
}

function SettingsLoading() {
  return (
    <div className="w-full py-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <LinkButton variant="ghost" size="icon" href="/">
          <Home className="w-5 h-5" />
        </LinkButton>
      </header>
      <div className="space-y-8">
        {/* Hatena Connection skeleton */}
        <div>
          <Skeleton className="h-4 w-28 mb-2" />
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-64 mb-3" />
          <Skeleton className="h-9 w-36" />
        </div>

        <Separator />

        {/* Preferences skeleton */}
        <div>
          <Skeleton className="h-4 w-24 mb-3" />
          <div className="space-y-4">
            {/* Theme */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-9 w-48" />
            </div>
            {/* Auto-save */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
            {/* AI auto-generation */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-72" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
            {/* Notifications */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          </div>
        </div>

        <Separator />

        {/* About skeleton */}
        <div>
          <Skeleton className="h-4 w-12 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
    </div>
  );
}

interface SettingsPageProps {
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default function SettingsPage({ searchParams }: SettingsPageProps) {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent searchParams={searchParams} />
    </Suspense>
  );
}
