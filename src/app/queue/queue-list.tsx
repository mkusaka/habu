"use client";

import { useState, useRef, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useVirtualizer } from "@tanstack/react-virtual";
import { db, deleteQueueItem, clearCompletedItems, recoverErrorItem } from "@/lib/queue-db";
import { saveBookmark } from "@/lib/bookmark-client";
import type { BookmarkQueue } from "@/types/habu";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Sparkles,
  Trash2,
  Copy,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Extract tags from comment string like "[tag1][tag2]summary text"
function parseComment(comment: string): { tags: string[]; text: string } {
  const tagRegex = /^\[([^\]]+)\]/g;
  const tags: string[] = [];
  let remaining = comment;

  let match;
  while ((match = tagRegex.exec(comment)) !== null) {
    tags.push(match[1]);
    remaining = comment.slice(tagRegex.lastIndex);
  }

  return { tags, text: remaining.trim() };
}

/**
 * Hook to recover error/queued items by checking if bookmarks already exist on Hatena
 * Runs once when error or queued items are detected, fetches bookmark status in parallel
 * Returns set of item IDs currently being checked
 */
function useRecoverItems(items: BookmarkQueue[] | undefined): Set<number> {
  const [recoveredIds, setRecoveredIds] = useState<Set<number>>(new Set());
  const [checkingIds, setCheckingIds] = useState<Set<number>>(new Set());
  const isRecoveringRef = useRef(false);

  useEffect(() => {
    if (!items || isRecoveringRef.current) return;

    const itemsToCheck = items.filter(
      (item) =>
        (item.status === "error" || item.status === "queued") &&
        item.id &&
        !recoveredIds.has(item.id),
    );

    if (itemsToCheck.length === 0) return;

    isRecoveringRef.current = true;

    // Mark items as checking
    const itemIds = itemsToCheck.map((item) => item.id!);
    setCheckingIds(new Set(itemIds));

    const recoverItems = async () => {
      // Fetch all items in parallel
      const results = await Promise.allSettled(
        itemsToCheck.map(async (item) => {
          const response = await fetch(`/api/habu/bookmark?url=${encodeURIComponent(item.url)}`, {
            credentials: "include",
          });

          if (response.ok) {
            const bookmark = (await response.json()) as {
              url: string;
              comment: string;
              tags: string[];
              created_datetime: string;
            };
            return { item, bookmark };
          }

          // 404 means bookmark doesn't exist - not a recovery candidate
          return null;
        }),
      );

      // Process results and recover items that exist on Hatena
      const newRecoveredIds = new Set(recoveredIds);

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          const { item, bookmark } = result.value;
          if (item.id) {
            try {
              await recoverErrorItem(item.id, bookmark.comment, bookmark.tags);
              newRecoveredIds.add(item.id);
            } catch (error) {
              console.error(`Failed to recover item ${item.id}:`, error);
            }
          }
        }
      }

      if (newRecoveredIds.size > recoveredIds.size) {
        setRecoveredIds(newRecoveredIds);
      }

      // Clear checking state
      setCheckingIds(new Set());
      isRecoveringRef.current = false;
    };

    recoverItems();
  }, [items, recoveredIds]);

  return checkingIds;
}

export function QueueStats() {
  const items = useLiveQuery(() => db.bookmarks.orderBy("createdAt").reverse().toArray(), []);

  if (items === undefined) {
    return (
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div>
          <div className="font-semibold">-</div>
          <div className="text-muted-foreground">Queued</div>
        </div>
        <div>
          <div className="font-semibold">-</div>
          <div className="text-muted-foreground">Saved</div>
        </div>
        <div>
          <div className="font-semibold">-</div>
          <div className="text-muted-foreground">Errors</div>
        </div>
      </div>
    );
  }

  const completedCount = items.filter((item) => item.status === "done").length;
  const errorCount = items.filter((item) => item.status === "error").length;
  const queuedCount = items.filter((item) => item.status === "queued").length;

  return (
    <div className="grid grid-cols-3 gap-2 text-center text-sm">
      <div>
        <div className="font-semibold">{queuedCount}</div>
        <div className="text-muted-foreground">Queued</div>
      </div>
      <div>
        <div className="font-semibold">{completedCount}</div>
        <div className="text-muted-foreground">Saved</div>
      </div>
      <div>
        <div className="font-semibold">{errorCount}</div>
        <div className="text-muted-foreground">Errors</div>
      </div>
    </div>
  );
}

export function ClearCompletedButton() {
  const items = useLiveQuery(() => db.bookmarks.orderBy("createdAt").reverse().toArray(), []);
  const completedCount = items?.filter((item) => item.status === "done").length ?? 0;

  const handleClearCompleted = async () => {
    try {
      await clearCompletedItems();
      toast.success("Completed items cleared");
    } catch (error) {
      console.error("Clear failed:", error);
      toast.error("Clear failed");
    }
  };

  if (completedCount === 0) return null;

  return (
    <Button variant="outline" onClick={handleClearCompleted}>
      Clear Completed
    </Button>
  );
}

export function CopyAllUrlsButton() {
  const items = useLiveQuery(() => db.bookmarks.orderBy("createdAt").reverse().toArray(), []);

  const handleCopyAllUrls = async () => {
    if (!items || items.length === 0) return;

    try {
      const urls = items.map((item) => item.url).join("\n");
      await navigator.clipboard.writeText(urls);
      toast.success(`${items.length} URLs copied to clipboard`);
    } catch (error) {
      console.error("Copy failed:", error);
      toast.error("Failed to copy URLs");
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <Button variant="outline" onClick={handleCopyAllUrls}>
      <Copy className="w-4 h-4 mr-2" />
      Copy All URLs
    </Button>
  );
}

// Estimated height for each queue item (used for virtualization)
const ITEM_HEIGHT_ESTIMATE = 120;

// Sort items by status priority (sending > queued > error > done), then by updatedAt descending
function sortQueueItems(items: BookmarkQueue[]): BookmarkQueue[] {
  const statusOrder: Record<string, number> = { sending: 0, queued: 1, error: 2, done: 3 };
  return [...items].sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function QueueList() {
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const items = useLiveQuery(async () => {
    const allItems = await db.bookmarks.toArray();
    return sortQueueItems(allItems);
  }, []);
  const parentRef = useRef<HTMLDivElement>(null);

  // Attempt to recover error/queued items by checking if bookmarks already exist on Hatena
  const checkingIds = useRecoverItems(items);

  const virtualizer = useVirtualizer({
    count: items?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT_ESTIMATE,
    overscan: 5,
  });

  // Regenerate: re-run AI generation (for success items or error items without comment)
  const handleRegenerate = async (id: number) => {
    try {
      const item = await db.bookmarks.get(id);
      if (!item) {
        toast.error("Item not found");
        return;
      }

      await deleteQueueItem(id);

      // Pass empty comment to trigger AI regeneration, but preserve userContext
      const result = await saveBookmark(item.url, item.title, undefined, false, item.userContext);

      if (result.success) {
        toast.success(result.queued ? "Queued for regeneration" : "Bookmark regenerated!");
      } else {
        toast.error(result.error || "Regeneration failed");
      }
    } catch (error) {
      console.error("Regeneration failed:", error);
      toast.error("Regeneration failed");
    }
  };

  // Retry: re-send with existing comment (skip AI generation)
  const handleRetry = async (id: number) => {
    try {
      const item = await db.bookmarks.get(id);
      if (!item) {
        toast.error("Item not found");
        return;
      }

      await deleteQueueItem(id);

      // Pass skipAiGeneration=true to preserve existing comment and skip AI
      const result = await saveBookmark(item.url, item.title, item.comment, true, item.userContext);

      if (result.success) {
        toast.success(result.queued ? "Queued for retry" : "Bookmark saved!");
      } else {
        toast.error(result.error || "Retry failed");
      }
    } catch (error) {
      console.error("Retry failed:", error);
      toast.error("Retry failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteQueueItem(deleteTarget.id);
      toast.success("Item deleted");
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Delete failed");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied to clipboard");
    } catch (error) {
      console.error("Copy failed:", error);
      toast.error("Failed to copy URL");
    }
  };

  const getStatusIcon = (status: BookmarkQueue["status"], isChecking: boolean) => {
    if (isChecking) {
      return <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />;
    }
    switch (status) {
      case "done":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "sending":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: BookmarkQueue["status"], isChecking: boolean) => {
    if (isChecking) {
      return "確認中...";
    }
    switch (status) {
      case "done":
        return "Saved";
      case "sending":
        return "Sending...";
      case "error":
        return "Error";
      default:
        return "Queued";
    }
  };

  if (items === undefined) {
    return (
      <div className="animate-in fade-in duration-200">
        <div className="w-full p-3 rounded-md border">
          {/* Header skeleton */}
          <div className="flex items-center gap-3">
            <Skeleton className="w-5 h-5 rounded-full flex-shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <div className="flex items-center gap-1 flex-shrink-0">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
          {/* Body skeleton */}
          <div className="mt-1 pl-8 space-y-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground animate-in fade-in duration-200">
        <p>No bookmarks in queue</p>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <>
      <div ref={parentRef} className="h-full overflow-auto animate-in fade-in duration-200">
        <div
          className="relative w-full"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index];
            const isChecking = item.id ? checkingIds.has(item.id) : false;
            return (
              <div
                key={item.id || virtualRow.index}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="relative w-full text-left p-3 rounded-md border hover:bg-muted/50 transition-colors mb-2">
                  {/* Full card link for completed items */}
                  {item.status === "done" && (
                    <Link
                      href={`/bookmarks/detail?url=${encodeURIComponent(item.url)}`}
                      className="absolute inset-0"
                      aria-label={`Edit bookmark: ${item.title || item.url}`}
                    />
                  )}
                  {/* Header: Status icon, Title, Action buttons */}
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">{getStatusIcon(item.status, isChecking)}</div>
                    <h3 className="font-medium text-sm truncate flex-1 min-w-0">
                      {item.title || item.url}
                    </h3>
                    <div className="relative z-10 flex items-center gap-1 flex-shrink-0">
                      {item.status === "done" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent hover:text-accent-foreground"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>Open URL</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyUrl(item.url)}
                            className="cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy URL</TooltipContent>
                      </Tooltip>
                      {/* Error state: show Retry (if has comment) or Regenerate (if no comment) */}
                      {item.status === "error" && item.id && item.comment && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRetry(item.id!)}
                              className="cursor-pointer"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Retry</TooltipContent>
                        </Tooltip>
                      )}
                      {item.status === "error" && item.id && !item.comment && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRegenerate(item.id!)}
                              className="cursor-pointer"
                            >
                              <Sparkles className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Regenerate</TooltipContent>
                        </Tooltip>
                      )}
                      {/* Done state: always show Regenerate */}
                      {item.status === "done" && item.id && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRegenerate(item.id!)}
                              className="cursor-pointer"
                            >
                              <Sparkles className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Regenerate</TooltipContent>
                        </Tooltip>
                      )}
                      {item.id && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setDeleteTarget({ id: item.id!, title: item.title || item.url })
                              }
                              className="cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                  {/* Body: URL, Tags, Comment, Status */}
                  <div className="mt-1 pl-8">
                    <div className="text-xs text-muted-foreground truncate">{item.url}</div>
                    {(() => {
                      // Parse tags and summary from generatedSummary if generatedTags is not available
                      const hasTags = item.generatedTags && item.generatedTags.length > 0;
                      const parsed =
                        item.status === "done" && item.generatedSummary && !hasTags
                          ? parseComment(item.generatedSummary)
                          : null;
                      const displayTags = hasTags ? item.generatedTags : parsed?.tags;
                      const displaySummary = parsed ? parsed.text : item.generatedSummary;

                      return (
                        <>
                          {item.status === "done" && displayTags && displayTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {displayTags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.status === "done" && displaySummary && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {displaySummary}
                            </p>
                          )}
                        </>
                      );
                    })()}
                    {item.comment && !item.generatedSummary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {item.comment}
                      </p>
                    )}
                    {item.lastError && (
                      <div className="text-xs text-red-600 mt-1 p-2 bg-red-50 rounded border border-red-200">
                        <span className="font-semibold">Error:</span> {item.lastError}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {getStatusText(item.status, isChecking)} •{" "}
                      {new Date(item.createdAt).toLocaleString()}
                      {item.retryCount > 0 && ` • Retry ${item.retryCount}`}
                      {item.nextRetryAt && item.status === "error" && (
                        <span>
                          {" "}
                          • Next retry: {new Date(item.nextRetryAt).toLocaleTimeString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bookmark?</AlertDialogTitle>
            <AlertDialogDescription className="break-all">
              {deleteTarget?.title}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
