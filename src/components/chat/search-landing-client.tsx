"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Clock3, ExternalLink, History, Home, Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import type { ChatThreadSummary } from "@/lib/chat-history";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SearchLandingClientProps {
  initialUrl?: string;
  recentBookmarks: {
    url: string;
    title: string;
    comment: string;
    tags: string[];
    bookmarkedAt: string;
  }[];
  selectedBookmark?: {
    url: string;
    title: string;
    comment: string;
    tags: string[];
    bookmarkedAt: string;
  };
  historyThreads: ChatThreadSummary[];
}

export function SearchLandingClient({
  initialUrl,
  recentBookmarks,
  selectedBookmark: initialSelectedBookmark,
  historyThreads,
}: SearchLandingClientProps) {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState(initialUrl ?? "");
  const [messageInput, setMessageInput] = useState("");
  const [selectedBookmark, setSelectedBookmark] = useState(initialSelectedBookmark);
  const recentHistory = historyThreads.slice(0, 5);

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

  const suggestionCards = urlInput
    ? [
        "What did I already bookmark that relates to this URL?",
        "Summarize what matters about this URL for my bookmarks.",
        "Find similar bookmarks and common tags for this URL.",
      ]
    : [
        "Show me recent AI-related bookmarks.",
        "What are the most common tags in my bookmarks?",
        "Find bookmarks about search UX changes.",
      ];

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
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Search</h1>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/search/histories"
                  className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                >
                  <History className="h-4 w-4" />
                  <span className="sr-only">Histories</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Histories</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
                  <Home className="h-4 w-4" />
                  <span className="sr-only">Home</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Home</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <Card className="gap-0 py-0">
            <CardHeader className="gap-1 border-b px-4 py-3 sm:px-5">
              <CardTitle className="text-base">Ask about your bookmarks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 py-4 sm:px-5">
              <form onSubmit={handleStartSearch} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Ask something</label>
                  <Textarea
                    value={messageInput}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      setMessageInput(e.target.value)
                    }
                    placeholder="Ask about your bookmarks..."
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={!messageInput.trim() && !urlInput.trim()}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Start Search Session
                </Button>
              </form>
            </CardContent>
          </Card>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">Quick Starts</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {suggestionCards.map((suggestion) => (
                <Card
                  key={suggestion}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer gap-0 py-0 transition-colors hover:bg-accent"
                  onClick={() =>
                    openSearchSession({
                      sessionId: crypto.randomUUID(),
                      query: suggestion,
                      url: urlInput || undefined,
                    })
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    openSearchSession({
                      sessionId: crypto.randomUUID(),
                      query: suggestion,
                      url: urlInput || undefined,
                    })
                  }
                >
                  <CardContent className="px-4 py-4 text-left text-sm">{suggestion}</CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">Recent History</h2>
            </div>
            <div className="space-y-1">
              {recentHistory.length === 0 ? (
                <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                  No saved conversations yet.
                </div>
              ) : (
                recentHistory.map((thread) => (
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
          </section>

          {!urlInput && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium">Recent Bookmarks</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {recentBookmarks.map((bookmark) => (
                  <Card
                    key={bookmark.url}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      openSearchSession({
                        sessionId: crypto.randomUUID(),
                        url: bookmark.url,
                      })
                    }
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      openSearchSession({
                        sessionId: crypto.randomUUID(),
                        url: bookmark.url,
                      })
                    }
                    className="cursor-pointer gap-0 py-0 transition-colors hover:bg-accent"
                  >
                    <CardContent className="px-4 py-4 text-left">
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {selectedBookmark && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium">Selected Bookmark</h2>
              </div>
              <Card
                role="button"
                tabIndex={0}
                onClick={() => {
                  setUrlInput("");
                  setSelectedBookmark(undefined);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setUrlInput("");
                    setSelectedBookmark(undefined);
                  }
                }}
                className="w-full cursor-pointer gap-0 py-0 transition-colors hover:bg-accent"
              >
                <CardContent className="px-4 py-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {selectedBookmark.title || selectedBookmark.url}
                      </div>
                      <div className="mt-1 break-all text-xs text-muted-foreground">
                        {selectedBookmark.url}
                      </div>
                    </div>
                    <X className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  {selectedBookmark.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {selectedBookmark.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {selectedBookmark.comment && (
                    <div className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                      {selectedBookmark.comment}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
