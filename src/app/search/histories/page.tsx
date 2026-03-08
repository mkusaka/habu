import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AlertCircle } from "lucide-react";
import { SearchHistoriesClient } from "@/components/chat/search-histories-client";
import { createAuth } from "@/lib/auth";
import { buildMcpContextForUser } from "@/lib/bookmark-user-context";
import { LinkButton } from "@/components/ui/link-button";
import { listChatThreadsForHatenaAccount } from "@/lib/chat-history";

export default async function SearchHistoriesPage() {
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
      <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-4 py-16 text-center">
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
      <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-4 py-16 text-center">
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

  return <SearchHistoriesClient historyThreads={historyThreads} />;
}
