"use client";

import { History, Home, MessageSquare, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChatThreadSummary } from "@/lib/chat-history";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SearchPageShell } from "./search-page-shell";

interface SearchHistoriesClientProps {
  historyThreads: ChatThreadSummary[];
}

function formatUpdatedAt(timestamp: Date): string {
  return timestamp.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

export function SearchHistoriesClient({ historyThreads }: SearchHistoriesClientProps) {
  const router = useRouter();

  return (
    <SearchPageShell
      title="Histories"
      icon={History}
      description={
        <p className="text-sm text-muted-foreground">
          {historyThreads.length} saved conversation{historyThreads.length === 1 ? "" : "s"}
        </p>
      }
      actions={
        <>
          <Link href="/search" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
            <Search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Link>
          <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
            <Home className="h-4 w-4" />
            <span className="sr-only">Home</span>
          </Link>
        </>
      }
    >
      {historyThreads.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-muted p-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">No saved conversations yet.</p>
              <p className="text-sm text-muted-foreground">
                Start a new bookmark search to build your history.
              </p>
            </div>
            <Link href="/search" className={cn(buttonVariants({ variant: "outline" }))}>
              Open Search
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {historyThreads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              className="w-full text-left"
              onClick={() => router.push(`/search/${thread.id}`)}
            >
              <Card className="h-full gap-0 overflow-hidden py-0 transition-colors hover:bg-accent">
                <CardHeader className="gap-1 px-4 py-4">
                  <CardTitle className="line-clamp-1 text-base">
                    {thread.title || thread.query || thread.url || "Untitled Search"}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 break-all">
                    {thread.lastMessagePreview || thread.query || thread.url || "No preview"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4 pt-0">
                  {thread.query ? (
                    <div className="text-xs text-muted-foreground">Query: {thread.query}</div>
                  ) : null}
                  {thread.url ? (
                    <div className="break-all text-xs text-muted-foreground">{thread.url}</div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{thread.messageCount} messages</span>
                    <span>{formatUpdatedAt(thread.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </SearchPageShell>
  );
}
