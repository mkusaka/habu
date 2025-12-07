"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteQueueItem, clearCompletedItems } from "@/lib/queue-db";
import { triggerSync } from "@/lib/queue-sync";
import type { BookmarkQueue } from "@/types/habu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  RefreshCw,
  Trash2,
  Home,
  Copy,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

export default function QueuePage() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [swAvailable, setSwAvailable] = useState<boolean | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);

  // Check if Service Worker is available
  useEffect(() => {
    async function checkSW() {
      if (!("serviceWorker" in navigator)) {
        setSwAvailable(false);
        return;
      }
      const registrations = await navigator.serviceWorker.getRegistrations();
      setSwAvailable(registrations.length > 0);
    }
    checkSW();
  }, []);

  // Use live query to automatically update when IndexedDB changes
  const items = useLiveQuery(() => db.bookmarks.orderBy("createdAt").reverse().toArray(), []);

  const loading = items === undefined;

  const handleSync = async () => {
    console.log("handleSync: setting syncing to true");
    setSyncing(true);
    try {
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Sync timeout")), 5000),
      );
      console.log("handleSync: calling triggerSync");
      await Promise.race([triggerSync(), timeoutPromise]);
      console.log("handleSync: triggerSync completed");
      toast.success("Sync triggered");
    } catch (error) {
      console.error("handleSync: error:", error);
      toast.error("Sync failed");
    } finally {
      console.log("handleSync: setting syncing to false");
      setSyncing(false);
    }
  };

  const handleRetry = async (id: number) => {
    try {
      // Get the item data before deleting
      const item = await db.bookmarks.get(id);
      if (!item) {
        toast.error("Item not found");
        return;
      }

      // Delete the old item
      await deleteQueueItem(id);

      // Re-save via fetch (SW will intercept and process)
      const { saveBookmark } = await import("@/lib/queue-sync");
      const result = await saveBookmark(item.url, item.title, item.comment);

      if (result.success) {
        if (result.queued) {
          toast.success("Queued for retry");
        } else {
          toast.success("Bookmark saved!");
        }
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

  const handleClearCompleted = async () => {
    try {
      await clearCompletedItems();
      toast.success("Completed items cleared");
    } catch (error) {
      console.error("Clear failed:", error);
      toast.error("Clear failed");
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const completedCount = items.filter((item) => item.status === "done").length;
  const errorCount = items.filter((item) => item.status === "error").length;
  const queuedCount = items.filter((item) => item.status === "queued").length;

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Bookmark Queue</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
              <Home className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-1">
                  <Button
                    onClick={handleSync}
                    disabled={syncing || swAvailable === false}
                    className="w-full"
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync Now
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {swAvailable === false && (
                <TooltipContent>Background sync is not available</TooltipContent>
              )}
            </Tooltip>
            {completedCount > 0 && (
              <Button variant="outline" onClick={handleClearCompleted}>
                Clear Completed
              </Button>
            )}
          </div>

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

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => router.push("/settings")}
          >
            <Settings className="w-4 h-4 mr-2" />
            Connect to Hatena Bookmark
          </Button>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No bookmarks in queue
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <Card key={item.id || index}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getStatusIcon(item.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.title || item.url}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.url}</div>
                    {/* Show AI-generated content for completed items */}
                    {item.status === "done" && item.generatedSummary && (
                      <div className="text-xs mt-1 p-2 bg-green-50 rounded border border-green-200">
                        <div className="text-green-700">{item.generatedSummary}</div>
                        {item.generatedTags && item.generatedTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.generatedTags.map((tag, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Show original comment if no generated content */}
                    {item.comment && !item.generatedSummary && (
                      <div className="text-xs text-muted-foreground mt-1">{item.comment}</div>
                    )}
                    {item.lastError && (
                      <div className="text-xs text-red-600 mt-1 p-2 bg-red-50 rounded border border-red-200">
                        <span className="font-semibold">Error:</span> {item.lastError}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {getStatusText(item.status)} • {new Date(item.createdAt).toLocaleString()}
                      {item.retryCount > 0 && ` • Retry ${item.retryCount}`}
                      {item.nextRetryAt && item.status === "error" && (
                        <span>
                          {" "}
                          • Next retry: {new Date(item.nextRetryAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
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
                        onClick={() =>
                          setDeleteTarget({ id: item.id!, title: item.title || item.url })
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
    </div>
  );
}
