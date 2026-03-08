"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Home, MessageCircle } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import type { ChatThreadSummary } from "@/lib/chat-history";
import { SearchPanel } from "./search-panel";

interface SearchLandingClientProps {
  initialQuery?: string;
  initialUrl?: string;
  historyThreads: ChatThreadSummary[];
}

export function SearchLandingClient({
  initialQuery,
  initialUrl,
  historyThreads,
}: SearchLandingClientProps) {
  const router = useRouter();
  const [queryInput, setQueryInput] = useState(initialQuery ?? "");
  const [urlInput, setUrlInput] = useState(initialUrl ?? "");

  const openSearchSession = (params: { query?: string; url?: string; sessionId?: string }) => {
    const normalizedQuery = params.query?.trim() || "";
    const normalizedUrl = params.url?.trim() || "";

    if (!params.sessionId) {
      return;
    }

    const searchParams = new URLSearchParams();
    if (normalizedQuery) searchParams.set("q", normalizedQuery);
    if (normalizedUrl) searchParams.set("url", normalizedUrl);
    const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
    router.push(`/search/${params.sessionId}${suffix}`);
  };

  const handleStartSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    openSearchSession({
      sessionId: crypto.randomUUID(),
      query: queryInput,
      url: urlInput,
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Search</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Start a new bookmark search session or reopen one from history.
            </p>
          </div>
          <LinkButton href="/" variant="ghost" size="icon">
            <Home className="h-4 w-4" />
          </LinkButton>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-0 md:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="border-b bg-muted/20 md:border-r md:border-b-0">
          <SearchPanel
            queryInput={queryInput}
            urlInput={urlInput}
            historyThreads={historyThreads}
            submitLabel="Start Search Session"
            onQueryChange={setQueryInput}
            onUrlChange={setUrlInput}
            onStartSearch={handleStartSearch}
            onStartBlankSearch={() =>
              openSearchSession({
                sessionId: crypto.randomUUID(),
              })
            }
            onOpenSearch={openSearchSession}
          />
        </aside>

        <section className="flex items-center justify-center px-6 py-10 sm:px-8">
          <div className="max-w-md text-center">
            <MessageCircle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-medium">Start a search session</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You can start with a free-form query, an optional page URL, or a blank session and ask
              questions right away.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
