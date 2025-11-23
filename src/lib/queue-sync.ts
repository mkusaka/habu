"use client";

import {
  getQueuedItems,
  updateQueueStatus,
  addToQueue as addToQueueDb,
} from "@/lib/queue-db";
import type { BookmarkRequest, BookmarkResponse } from "@/types/habu";

// Sync queue with server
export async function syncQueue(): Promise<void> {
  const items = await getQueuedItems();

  for (const item of items) {
    if (!item.id) continue;

    try {
      // Update status to sending
      await updateQueueStatus(item.id, "sending");

      // Send to server
      const response = await fetch("/api/habu/bookmark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          url: item.url,
          comment: item.comment,
        } as BookmarkRequest),
      });

      const result: BookmarkResponse = await response.json();

      if (result.success) {
        // Mark as done
        await updateQueueStatus(item.id, "done");
      } else {
        // Mark as error with retry
        await updateQueueStatus(
          item.id,
          "error",
          result.error || "Unknown error"
        );
      }
    } catch (error) {
      // Network or other error
      await updateQueueStatus(
        item.id,
        "error",
        error instanceof Error ? error.message : "Network error"
      );
    }
  }
}

// Add bookmark optimistically
export async function saveBookmarkOptimistic(
  url: string,
  title?: string,
  comment?: string
): Promise<number> {
  // Add to IndexedDB queue
  const id = await addToQueueDb(url, title, comment);

  // Trigger sync in background (don't wait)
  syncQueue().catch((error) => {
    console.error("Background sync failed:", error);
  });

  return id;
}

// Setup background sync
let syncInterval: NodeJS.Timeout | null = null;

export function startBackgroundSync(intervalSeconds = 30): void {
  if (syncInterval) {
    return; // Already running
  }

  // Initial sync
  syncQueue().catch(console.error);

  // Periodic sync
  syncInterval = setInterval(() => {
    syncQueue().catch(console.error);
  }, intervalSeconds * 1000);

  // Sync on visibility change (when user comes back to tab or leaves tab)
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      syncQueue().catch(console.error);
    });
  }

  // Sync on online event
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      syncQueue().catch(console.error);
    });
  }
}

export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
