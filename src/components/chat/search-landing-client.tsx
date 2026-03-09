"use client";

import {
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Clock3, ExternalLink, History, Home, Search, Send, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import type { ChatThreadSummary } from "@/lib/chat-history";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SearchPageShell } from "./search-page-shell";

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

interface ComposerProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCompositionStart?: () => void;
  onCompositionEnd?: () => void;
  disabled: boolean;
  selectedBookmark?: SearchLandingClientProps["selectedBookmark"];
  onClearSelectedBookmark?: () => void;
  className?: string;
  footer?: ReactNode;
}

function Composer({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  disabled,
  selectedBookmark,
  onClearSelectedBookmark,
  className,
  footer,
}: ComposerProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-3xl border border-border/80 bg-card/95 py-0 shadow-lg",
        className,
      )}
    >
      <CardContent className="space-y-3 px-4 py-4">
        {selectedBookmark ? (
          <Badge asChild variant="secondary" className="max-w-full px-3 py-1">
            <button
              type="button"
              onClick={onClearSelectedBookmark}
              className="inline-flex items-center gap-2 transition-colors hover:bg-accent"
            >
              <Bookmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedBookmark.title || selectedBookmark.url}</span>
              <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </Badge>
        ) : null}

        <form onSubmit={onSubmit} className="flex items-end gap-3">
          <Textarea
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            placeholder="Search your bookmarks..."
            rows={2}
            className="min-h-24 flex-1 resize-none rounded-2xl border border-border/70 bg-muted/35 px-4 py-3 shadow-none placeholder:text-muted-foreground/85 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 rounded-full shadow-sm"
            disabled={disabled}
            aria-label="Start search session"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>

        {footer ? <div className="pt-1">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

function SectionHeading({ icon: Icon, title }: { icon: typeof Clock3; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h2 className="text-sm font-medium">{title}</h2>
    </div>
  );
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
  const [isComposing, setIsComposing] = useState(false);
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
        "Show me my recent bookmarks.",
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

  const handleInputKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      if (!messageInput.trim() && !urlInput.trim()) {
        return;
      }

      openSearchSession({
        sessionId: crypto.randomUUID(),
        query: messageInput,
        url: urlInput,
      });
    }
  };

  const clearSelectedBookmark = () => {
    setUrlInput("");
    setSelectedBookmark(undefined);
  };

  const recentBookmarksSection = !urlInput ? (
    <section className="min-w-0 space-y-3">
      <SectionHeading icon={Bookmark} title="Recent Bookmarks" />
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {recentBookmarks.map((bookmark) => (
          <button
            key={bookmark.url}
            type="button"
            className="min-w-0 w-full text-left"
            onClick={() =>
              openSearchSession({
                sessionId: crypto.randomUUID(),
                url: bookmark.url,
              })
            }
          >
            <Card className="h-full overflow-hidden gap-0 py-0 transition-colors hover:bg-accent">
              <CardHeader className="min-w-0 gap-1 px-4 py-4">
                <CardTitle className="line-clamp-2 text-sm leading-5">
                  {bookmark.title || bookmark.url}
                </CardTitle>
                <CardDescription className="line-clamp-2 break-words">
                  {bookmark.comment || bookmark.url}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 break-all">{bookmark.url}</span>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </section>
  ) : null;

  return (
    <SearchPageShell
      title="Search"
      icon={Search}
      bodyClassName="h-full"
      actions={
        <>
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
        </>
      }
    >
      <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-6">
        <div className="hidden min-h-[42vh] items-center justify-center md:flex">
          <div className="w-full max-w-2xl">
            <Composer
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onSubmit={handleStartSearch}
              onKeyDown={handleInputKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              disabled={!messageInput.trim() && !urlInput.trim()}
              selectedBookmark={selectedBookmark}
              onClearSelectedBookmark={clearSelectedBookmark}
            />
          </div>
        </div>

        <div className="min-w-0 space-y-6 pb-32 md:pb-0">
          {selectedBookmark ? (
            <section className="min-w-0 space-y-3">
              <SectionHeading icon={Bookmark} title="Selected Bookmark" />
              <button type="button" onClick={clearSelectedBookmark} className="w-full text-left">
                <Card className="w-full gap-0 py-0 transition-colors hover:bg-accent">
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
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                    {selectedBookmark.tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {selectedBookmark.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {selectedBookmark.comment ? (
                      <div className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                        {selectedBookmark.comment}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </button>
            </section>
          ) : null}

          <div className="grid min-w-0 items-start gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <section className="min-w-0 space-y-3">
              <SectionHeading icon={Clock3} title="Quick Starts" />
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                {suggestionCards.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="min-w-0 w-full text-left"
                    onClick={() =>
                      openSearchSession({
                        sessionId: crypto.randomUUID(),
                        query: suggestion,
                        url: urlInput || undefined,
                      })
                    }
                  >
                    <Card className="h-full min-w-0 gap-0 overflow-hidden py-0 transition-colors hover:bg-accent">
                      <CardContent className="min-w-0 break-words px-4 py-4 text-sm">
                        {suggestion}
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            </section>

            <section className="min-w-0 space-y-3">
              <SectionHeading icon={History} title="Recent History" />
              <div className="min-w-0 space-y-2">
                {recentHistory.length === 0 ? (
                  <Card className="gap-0 py-0">
                    <CardContent className="px-4 py-3 text-sm text-muted-foreground">
                      No saved conversations yet.
                    </CardContent>
                  </Card>
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
                      className="min-w-0 w-full text-left"
                    >
                      <Card className="min-w-0 gap-0 overflow-hidden py-0 transition-colors hover:bg-accent">
                        <CardContent className="min-w-0 space-y-1 px-4 py-3">
                          <div className="min-w-0 truncate text-sm font-medium">
                            {thread.title || thread.query || thread.url || "Untitled Search"}
                          </div>
                          <div className="min-w-0 truncate text-xs text-muted-foreground">
                            {thread.lastMessagePreview ||
                              thread.query ||
                              thread.url ||
                              "No preview"}
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>

          {recentBookmarksSection}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 px-4 md:hidden">
        <div className="mx-auto max-w-4xl">
          <Composer
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onSubmit={handleStartSearch}
            onKeyDown={handleInputKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            disabled={!messageInput.trim() && !urlInput.trim()}
            selectedBookmark={selectedBookmark}
            onClearSelectedBookmark={clearSelectedBookmark}
            className="bg-background/95 backdrop-blur"
          />
        </div>
      </div>
    </SearchPageShell>
  );
}
