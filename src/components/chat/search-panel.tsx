"use client";

import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      <form onSubmit={onStartSearch} className="flex flex-col gap-4 border-b p-4">
        <FieldGroup className="gap-4">
          {showQueryInput && (
            <Field>
              <FieldLabel htmlFor="search-panel-query">Search query</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="search-panel-query"
                  value={queryInput}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder="Search your bookmarks"
                  type="text"
                />
              </InputGroup>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="search-panel-url">Page URL (optional)</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="search-panel-url"
                value={urlInput}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder="https://example.com/article"
                type="url"
              />
            </InputGroup>
            <FieldDescription>
              Optional. Include a page URL to search with extra context.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <Button type="submit" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          {submitLabel}
        </Button>
      </form>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">{historyTitle}</div>
          {visibleHistory.length === 0 ? (
            <Card className="gap-0 py-0">
              <CardContent className="px-3 py-3">
                <Empty className="gap-4 border-none p-4 md:p-4">
                  <EmptyHeader className="gap-1.5">
                    <EmptyMedia variant="icon">
                      <Plus />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm">No saved conversations yet</EmptyTitle>
                    <EmptyDescription>
                      Start a search to create your first reusable conversation.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
            </Card>
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
                className="w-full text-left"
              >
                <Card
                  className={cn(
                    "gap-0 py-0 transition-colors hover:bg-accent",
                    activeSessionId === thread.id && "border-primary bg-accent",
                  )}
                >
                  <CardContent className="space-y-1 px-4 py-3">
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
                  </CardContent>
                </Card>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );
}
