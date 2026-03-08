import { cookies } from "next/headers";
import type { UIMessage } from "ai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AlertCircle } from "lucide-react";
import { createAuth } from "@/lib/auth";
import { ChatPageClient } from "@/components/chat/chat-page-client";
import { buildMcpContextForUser } from "@/lib/bookmark-user-context";
import { LinkButton } from "@/components/ui/link-button";
import { buildChatPageContextForUser } from "@/lib/chat-page-context";
import { getChatThreadForHatenaAccount, listChatThreadsForHatenaAccount } from "@/lib/chat-history";

interface SearchSessionPageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ q?: string; url?: string }>;
}

function isPublicHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default async function SearchSessionPage({ params, searchParams }: SearchSessionPageProps) {
  const { sessionId } = await params;
  const queryParams = await searchParams;
  const query = queryParams.q?.trim() || undefined;
  const selectedUrl = queryParams.url?.trim() || undefined;

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

  let initialMessages: UIMessage[] = [];
  let title: string | undefined;
  let error: string | undefined;
  const thread = await getChatThreadForHatenaAccount(mcpContext.hatenaId, sessionId, env.DB);
  const effectiveUrl = selectedUrl ?? thread?.url;
  const effectiveQuery = query ?? thread?.query;

  if (effectiveUrl && !isPublicHttpUrl(effectiveUrl)) {
    error = "Please provide a valid public http/https URL.";
    title = "Invalid URL";
  }

  const shouldAutoStartQuery = !thread && !!query && !error;

  const pageContext = await buildChatPageContextForUser({
    userId: session.user.id,
    url: error ? undefined : effectiveUrl,
    query: effectiveQuery,
    dbBinding: env.DB,
    env: {
      HATENA_CONSUMER_KEY: env.HATENA_CONSUMER_KEY,
      HATENA_CONSUMER_SECRET: env.HATENA_CONSUMER_SECRET,
    },
  });

  initialMessages = thread?.messages ?? [];
  title = title || thread?.title || (effectiveUrl ? pageContext.title : undefined) || "Search";

  return (
    <ChatPageClient
      key={sessionId}
      sessionId={sessionId}
      initialQuery={effectiveQuery ?? pageContext.context.query}
      initialPrompt={shouldAutoStartQuery ? effectiveQuery : undefined}
      selectedUrl={effectiveUrl ?? pageContext.context.url}
      context={pageContext.context}
      initialMessages={initialMessages}
      historyThreads={historyThreads}
      title={title}
      error={error}
    />
  );
}
