import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AlertCircle } from "lucide-react";
import { createAuth } from "@/lib/auth";
import { SearchLandingClient } from "@/components/chat/search-landing-client";
import { buildMcpContextForUser } from "@/lib/bookmark-user-context";
import { LinkButton } from "@/components/ui/link-button";
import { listChatThreadsForHatenaAccount } from "@/lib/chat-history";
import { listBookmarks } from "@/mcp/tools/list-bookmarks";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; url?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const initialUrl = params.url?.trim() || undefined;

  const cookieStore = await cookies();
  const { env } = getCloudflareContext();
  const auth = createAuth(env.DB);

  const session = await auth.api.getSession({
    headers: {
      cookie: cookieStore.toString(),
    },
  });

  if (!session?.user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>You need to sign in to use page search.</span>
        </div>
        <LinkButton href="/" variant="outline">
          Back to Home
        </LinkButton>
      </div>
    );
  }

  const mcpContext = await buildMcpContextForUser(session.user.id, env.DB);
  if (!mcpContext?.hatenaId) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Connect your Hatena account to use bookmark search.</span>
        </div>
        <LinkButton href="/settings" variant="outline">
          Open Settings
        </LinkButton>
      </div>
    );
  }

  const historyThreads = await listChatThreadsForHatenaAccount(mcpContext.hatenaId, env.DB);
  const recentBookmarksResult = await listBookmarks({ limit: 5, offset: 0 }, mcpContext, {
    HATENA_CONSUMER_KEY: env.HATENA_CONSUMER_KEY,
    HATENA_CONSUMER_SECRET: env.HATENA_CONSUMER_SECRET,
  });
  const recentBookmarks = recentBookmarksResult.success ? recentBookmarksResult.data.bookmarks : [];

  return (
    <SearchLandingClient
      initialUrl={initialUrl}
      recentBookmarks={recentBookmarks}
      historyThreads={historyThreads}
    />
  );
}
