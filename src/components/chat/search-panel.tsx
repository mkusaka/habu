"use client";

import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatThreadSummary } from "@/lib/chat-history";
import { cn } from "@/lib/utils";

interface SearchPanelProps {
  activeSessionId?: string;
  queryInput: string;
  urlInput: string;
  historyThreads: ChatThreadSummary[];
  historyTitle?: string;
  historyLimit?: number;
  showQueryInput?: boolean;
  submitLabel?: string;
  onQueryChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onStartSearch: (e: FormEvent<HTMLFormElement>) => void;
  onOpenSearch: (params: { query?: string; url?: string; sessionId?: string }) => void;
}

function formatRelativeDate(timestamp: Date): string {
  return timestamp.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

export function SearchPanel({
  activeSessionId,
  queryInput,
  urlInput,
  historyThreads,
  historyTitle = "Recent History",
  historyLimit = 5,
  showQueryInput = true,
  submitLabel = "Open Search",
  onQueryChange,
  onUrlChange,
  onStartSearch,
  onOpenSearch,
}: SearchPanelProps) {
  const visibleHistory = historyThreads.slice(0, historyLimit);

  return (
    <>
      <form onSubmit={onStartSearch} className="space-y-2 border-b p-4">
        {showQueryInput && (
          <>
            <label className="text-xs font-medium text-muted-foreground">Search query</label>
            <Input
              value={queryInput}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search your bookmarks"
              type="text"
            />
          </>
        )}
        <label className="text-xs font-medium text-muted-foreground">Page URL (optional)</label>
        <Input
          value={urlInput}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://example.com/article"
          type="url"
        />
        <Button type="submit" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          {submitLabel}
        </Button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">{historyTitle}</div>
        <div className="space-y-1">
          {visibleHistory.length === 0 ? (
            <div className="rounded-md px-3 py-2 text-sm text-muted-foreground">
              No saved conversations yet.
            </div>
          ) : (
            visibleHistory.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() =>
                  onOpenSearch({
                    sessionId: thread.id,
                    query: thread.query,
                    url: thread.url,
                  })
                }
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent",
                  activeSessionId === thread.id && "border-primary bg-accent",
                )}
              >
                <div className="truncate text-sm font-medium">
                  {thread.title || thread.query || thread.url || "Untitled Search"}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {thread.lastMessagePreview || thread.query || thread.url || "No preview"}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{thread.messageCount} messages</span>
                  <span>{formatRelativeDate(thread.updatedAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
