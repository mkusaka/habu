import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import Dexie from "dexie";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Background Sync API types
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
}

interface SyncManager {
  register(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}

// Message event type for SW
interface ExtendableMessageEvent extends ExtendableEvent {
  readonly data: { type?: string } | null;
}

declare global {
  interface ServiceWorkerGlobalScope {
    addEventListener(type: "sync", listener: (event: SyncEvent) => void): void;
    addEventListener(type: "message", listener: (event: ExtendableMessageEvent) => void): void;
  }
  interface ServiceWorkerRegistration {
    readonly sync: SyncManager;
  }
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// Track ongoing sync to prevent duplicate execution
let syncInProgress = false;

// Message event handler - for immediate sync via postMessage
self.addEventListener("message", (event) => {
  if (event.data?.type === "sync-now") {
    event.waitUntil((async () => {
      if (syncInProgress) {
        console.log("Sync already in progress, skipping");
        return;
      }
      syncInProgress = true;
      try {
        console.log("SW: Received sync-now message, starting sync");
        await syncBookmarkQueue();
        console.log("SW: Sync completed");
      } finally {
        syncInProgress = false;
      }
    })());
  }
});

// Background Sync event handler (fallback for offline scenarios)
self.addEventListener("sync", (event: SyncEvent) => {
  if (event.tag === "bookmark-sync") {
    event.waitUntil((async () => {
      if (syncInProgress) {
        console.log("Sync already in progress, skipping");
        return;
      }
      syncInProgress = true;
      try {
        await syncBookmarkQueue();
      } finally {
        syncInProgress = false;
      }
    })());
  }
});

// Dexie database for bookmark queue (same schema as queue-db.ts)
class HabuDatabase extends Dexie {
  bookmarks!: Dexie.Table<{
    id?: number;
    url: string;
    title?: string;
    comment?: string;
    status: "queued" | "sending" | "done" | "error";
    createdAt: Date;
    updatedAt: Date;
    lastError?: string;
    nextRetryAt?: number;
    retryCount: number;
  }, number>;

  constructor() {
    super("habu");
    this.version(1).stores({
      bookmarks: "++id, url, status, createdAt, nextRetryAt",
    });
  }
}

const db = new HabuDatabase();

// Sync bookmark queue from IndexedDB
async function syncBookmarkQueue(): Promise<void> {
  const now = Date.now();

  // Get queued items
  const items = await db.bookmarks
    .where("status")
    .anyOf("queued", "sending", "error")
    .filter((item) => {
      if (item.status === "queued") return true;
      if (item.status === "sending") {
        // Reset stuck "sending" items (older than 2 minutes)
        const twoMinutesAgo = now - 2 * 60 * 1000;
        return item.updatedAt.getTime() < twoMinutesAgo;
      }
      if (item.status === "error" && item.nextRetryAt) {
        return now >= item.nextRetryAt;
      }
      return false;
    })
    .toArray();

  // Process each item
  for (const item of items) {
    if (!item.id) continue;

    try {
      // Update status to sending
      await db.bookmarks.update(item.id, {
        status: "sending",
        updatedAt: new Date(),
      });

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
        }),
        signal: AbortSignal.timeout(30000),
        keepalive: true,
      });

      const result = await response.json() as { success: boolean; error?: string };

      if (result.success) {
        // Mark as done
        await db.bookmarks.update(item.id, {
          status: "done",
          updatedAt: new Date(),
        });
      } else {
        // Mark as error with retry
        const retryCount = (item.retryCount || 0) + 1;
        const retryDelays = [60000, 300000, 900000, 3600000];
        const delay = retryDelays[Math.min(retryCount - 1, retryDelays.length - 1)];

        await db.bookmarks.update(item.id, {
          status: "error",
          lastError: result.error || "Unknown error",
          retryCount,
          nextRetryAt: Date.now() + delay,
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      // Network or other error
      const retryCount = (item.retryCount || 0) + 1;
      const retryDelays = [60000, 300000, 900000, 3600000];
      const delay = retryDelays[Math.min(retryCount - 1, retryDelays.length - 1)];

      await db.bookmarks.update(item.id, {
        status: "error",
        lastError: error instanceof Error ? error.message : "Network error",
        retryCount,
        nextRetryAt: Date.now() + delay,
        updatedAt: new Date(),
      });
    }
  }
}
