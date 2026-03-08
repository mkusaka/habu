import { cookies } from "next/headers";
import type { UIMessage } from "ai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AlertCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { createAuth } from "@/lib/auth";
import { ChatPageClient } from "@/components/chat/chat-page-client";
import { buildMcpContextForUser } from "@/lib/bookmark-user-context";
import { LinkButton } from "@/components/ui/link-button";
import { buildChatPageContextForUser } from "@/lib/chat-page-context";
import { getChatThreadForHatenaAccount, listChatThreadsForHatenaAccount } from "@/lib/chat-history";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<{ session?: string; q?: string; url?: string }>;
}

function isPublicHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const sessionId = params.session?.trim() || undefined;
  const query = params.q?.trim() || undefined;
  const selectedUrl = params.url?.trim() || undefined;

  if (!sessionId && (query || selectedUrl)) {
    const nextSessionId = crypto.randomUUID();
    const redirectParams = new URLSearchParams({ session: nextSessionId });
    if (query) redirectParams.set("q", query);
    if (selectedUrl) redirectParams.set("url", selectedUrl);
    redirect(`/search?${redirectParams.toString()}`);
  }

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

  let initialMessages: UIMessage[] = [];
  let title: string | undefined;
  let error: string | undefined;
  let context: Awaited<ReturnType<typeof buildChatPageContextForUser>>["context"] | undefined;

  if (selectedUrl || query || sessionId) {
    if (selectedUrl && !isPublicHttpUrl(selectedUrl)) {
      error = "Please provide a valid public http/https URL.";
      title = "Invalid URL";
    } else if (sessionId) {
      const thread = await getChatThreadForHatenaAccount(mcpContext.hatenaId, sessionId, env.DB);
      const effectiveUrl = selectedUrl ?? thread?.url;
      const effectiveQuery = query ?? thread?.query;

      const pageContext = await buildChatPageContextForUser({
        userId: session.user.id,
        url: effectiveUrl,
        query: effectiveQuery,
        dbBinding: env.DB,
        env: {
          HATENA_CONSUMER_KEY: env.HATENA_CONSUMER_KEY,
          HATENA_CONSUMER_SECRET: env.HATENA_CONSUMER_SECRET,
        },
      });

      initialMessages = thread?.messages ?? [];
      context = pageContext.context;
      title = thread?.title || pageContext.title;
    }
  }

  return (
    <ChatPageClient
      key={sessionId ?? "search-home"}
      sessionId={sessionId}
      initialQuery={query ?? context?.query}
      selectedUrl={selectedUrl ?? context?.url}
      context={context}
      initialMessages={initialMessages}
      historyThreads={historyThreads}
      title={title}
      error={error}
    />
  );
}
