"use client";

import {
  getQueuedItems,
  updateQueueStatus,
  addToQueue as addToQueueDb,
} from "@/lib/queue-db";
import type { BookmarkRequest, BookmarkResponse } from "@/types/habu";

// Track ongoing sync to prevent duplicate execution
let syncInProgress = false;

// Sync queue with server
export async function syncQueue(): Promise<void> {
  if (syncInProgress) {
    console.log("Sync already in progress, skipping");
    return;
  }

  syncInProgress = true;
  try {
    await performSync();
  } finally {
    syncInProgress = false;
  }
}

async function performSync(): Promise<void> {
  const items = await getQueuedItems();

  for (const item of items) {
    if (!item.id) continue;

    try {
      // Update status to sending
      await updateQueueStatus(item.id, "sending");

      // Send to server with 30 second timeout
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
        signal: AbortSignal.timeout(30000),
        keepalive: true, // Allow request to complete even if page is closed
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

// Register background sync with Service Worker
export async function registerBackgroundSync(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("sync" in ServiceWorkerRegistration.prototype)) {
    console.warn("Background Sync not supported");
    return false;
  }

  try {
    // Timeout after 1 second to avoid blocking if SW is not ready
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Service Worker ready timeout")), 1000)
      ),
    ]);

    if (!registration) {
      return false;
    }

    await registration.sync.register("bookmark-sync");
    return true;
  } catch (error) {
    console.error("Failed to register background sync:", error);
    return false;
  }
}

// Add bookmark optimistically
export async function saveBookmarkOptimistic(
  url: string,
  title?: string,
  comment?: string
): Promise<number> {
  try {
    // Add to IndexedDB queue
    const id = await addToQueueDb(url, title, comment);

    // Register Background Sync (browser will trigger sync event)
    // Fire-and-forget: don't block on registration
    registerBackgroundSync().catch((error) => {
      console.error("Background Sync registration failed:", error);
      // Not critical - periodic sync will handle it
    });

    return id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error saving to queue";
    console.error("Failed to save bookmark to queue:", errorMessage, error);
    throw new Error(errorMessage);
  }
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
