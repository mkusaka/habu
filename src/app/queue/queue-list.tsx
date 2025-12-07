"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteQueueItem, clearCompletedItems } from "@/lib/queue-db";
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
import { CheckCircle2, Clock, AlertCircle, Loader2, RefreshCw, Trash2, Copy } from "lucide-react";
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

export function QueueList() {
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const items = useLiveQuery(() => db.bookmarks.orderBy("createdAt").reverse().toArray(), []);

  const handleRetry = async (id: number) => {
    try {
      const item = await db.bookmarks.get(id);
      if (!item) {
        toast.error("Item not found");
        return;
      }

      await deleteQueueItem(id);

      const result = await saveBookmark(item.url, item.title, item.comment);

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

  const getStatusIcon = (status: BookmarkQueue["status"]) => {
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

  const getStatusText = (status: BookmarkQueue["status"]) => {
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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No bookmarks in queue</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.id || index}
            className="w-full text-left p-3 rounded-md border hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{getStatusIcon(item.status)}</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{item.title || item.url}</h3>
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
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.comment}</p>
                )}
                {item.lastError && (
                  <div className="text-xs text-red-600 mt-1 p-2 bg-red-50 rounded border border-red-200">
                    <span className="font-semibold">Error:</span> {item.lastError}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {getStatusText(item.status)} • {new Date(item.createdAt).toLocaleString()}
                  {item.retryCount > 0 && ` • Retry ${item.retryCount}`}
                  {item.nextRetryAt && item.status === "error" && (
                    <span> • Next retry: {new Date(item.nextRetryAt).toLocaleTimeString()}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopyUrl(item.url)}
                  title="Copy URL"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                {(item.status === "error" || item.status === "done") && item.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRetry(item.id!)}
                    title="Re-save"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                )}
                {item.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget({ id: item.id!, title: item.title || item.url })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
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
