"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, ExternalLink, Home, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { ChatThreadSummary } from "@/lib/chat-history";

interface SearchLandingClientProps {
  initialUrl?: string;
  recentBookmarks: {
    url: string;
    title: string;
    comment: string;
    tags: string[];
    bookmarkedAt: string;
  }[];
  historyThreads: ChatThreadSummary[];
}

export function SearchLandingClient({
  initialUrl,
  recentBookmarks,
  historyThreads,
}: SearchLandingClientProps) {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState(initialUrl ?? "");
  const [messageInput, setMessageInput] = useState("");

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
    if (!messageInput.trim() && !urlInput.trim()) {
      return;
    }
    openSearchSession({
      sessionId: crypto.randomUUID(),
      query: messageInput,
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
              Start a new bookmark search session with an optional URL context.
            </p>
          </div>
          <LinkButton href="/" variant="ghost" size="icon">
            <Home className="h-4 w-4" />
          </LinkButton>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="px-4 py-6 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <form onSubmit={handleStartSearch} className="rounded-lg border bg-muted/20 p-4 sm:p-5">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Page URL (optional)
                </label>
                <div className="flex gap-2">
                  <Input
                    value={urlInput}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/article"
                    type="url"
                  />
                  {urlInput && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setUrlInput("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Ask something</label>
                <Textarea
                  value={messageInput}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setMessageInput(e.target.value)
                  }
                  placeholder="Ask about your bookmarks, or start from the optional URL above..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={!messageInput.trim() && !urlInput.trim()}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Start Search Session
                </Button>
              </div>
            </form>

            {!urlInput && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium">Recent Bookmarks</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {recentBookmarks.map((bookmark) => (
                    <button
                      key={bookmark.url}
                      type="button"
                      onClick={() => setUrlInput(bookmark.url)}
                      className="rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                    >
                      <div className="line-clamp-2 text-sm font-medium">
                        {bookmark.title || bookmark.url}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {bookmark.comment || bookmark.url}
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="truncate">{bookmark.url}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
              <MessageCircle className="mx-auto mb-3 h-8 w-8" />
              The search session will open after your first message so the conversation can keep a
              stable session ID.
            </div>
          </div>
        </section>

        <aside className="border-t bg-muted/20 lg:border-l lg:border-t-0">
          <div className="border-b px-4 py-3">
            <div className="text-sm font-medium">History</div>
            <div className="text-xs text-muted-foreground">Open a previous search session</div>
          </div>
          <div className="space-y-1 p-2">
            {historyThreads.length === 0 ? (
              <div className="rounded-md px-3 py-2 text-sm text-muted-foreground">
                No saved conversations yet.
              </div>
            ) : (
              historyThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() =>
                    openSearchSession({
                      sessionId: thread.id,
                    })
                  }
                  className="w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent"
                >
                  <div className="truncate text-sm font-medium">
                    {thread.title || thread.query || thread.url || "Untitled Search"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {thread.lastMessagePreview || thread.query || thread.url || "No preview"}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
