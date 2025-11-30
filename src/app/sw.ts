import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import Dexie from "dexie";

// This declares the value of `injectionPoint` to TypeScript.
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

interface SWMessageEvent extends ExtendableEvent {
  readonly data: unknown;
}

declare global {
  interface ServiceWorkerGlobalScope {
    addEventListener(type: "sync", listener: (event: SyncEvent) => void): void;
    addEventListener(type: "fetch", listener: (event: FetchEvent) => void): void;
    addEventListener(type: "message", listener: (event: SWMessageEvent) => void): void;
    readonly registration: ServiceWorkerRegistration;
    readonly location: { origin: string };
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

// =============================================================================
// Bookmark Queue Database (same schema as client-side queue-db.ts)
// =============================================================================

interface BookmarkQueueItem {
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
  // AI-generated content
  generatedComment?: string;
  generatedSummary?: string;
  generatedTags?: string[];
}

// API response type
interface BookmarkApiResponse {
  success: boolean;
  error?: string;
  queued?: boolean;
  generatedComment?: string;
  generatedSummary?: string;
  generatedTags?: string[];
}

class HabuDatabase extends Dexie {
  bookmarks!: Dexie.Table<BookmarkQueueItem, number>;

  constructor() {
    super("habu");
    this.version(1).stores({
      bookmarks: "++id, url, status, createdAt, nextRetryAt",
    });
  }
}

const db = new HabuDatabase();

// =============================================================================
// Fetch Event Interception for /api/habu/bookmark
// =============================================================================

self.addEventListener("fetch", (event: FetchEvent) => {
  const url = new URL(event.request.url);

  // Only intercept POST requests to /api/habu/bookmark
  if (url.pathname === "/api/habu/bookmark" && event.request.method === "POST") {
    event.respondWith(handleBookmarkRequest(event));
  }
});

async function handleBookmarkRequest(event: FetchEvent): Promise<Response> {
  const request = event.request.clone();

  try {
    // Parse request body to get bookmark data
    const body = (await request.json()) as { url: string; title?: string; comment?: string };

    // Save to IndexedDB first (for UI tracking)
    const queueId = await db.bookmarks.add({
      url: body.url,
      title: body.title,
      comment: body.comment,
      status: "sending",
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
    });

    // Try to send to server if online
    if (navigator.onLine) {
      try {
        const originalRequest = event.request.clone();
        const response = await fetch(originalRequest.url, {
          method: originalRequest.method,
          headers: originalRequest.headers,
          body: await originalRequest.text(),
          credentials: "include",
        });
        const result = (await response.clone().json()) as BookmarkApiResponse;

        if (result.success) {
          // Success - update status to done and store generated content
          await db.bookmarks.update(queueId, {
            status: "done",
            updatedAt: new Date(),
            generatedComment: result.generatedComment,
            generatedSummary: result.generatedSummary,
            generatedTags: result.generatedTags,
          });
          return response;
        } else {
          // API returned error - set retry info so it can be retried
          const retryCount = 1;
          const retryDelays = [60000, 300000, 900000, 3600000]; // 1min, 5min, 15min, 60min
          const delay = retryDelays[0];

          await db.bookmarks.update(queueId, {
            status: "error",
            lastError: result.error || "Unknown error",
            retryCount,
            nextRetryAt: Date.now() + delay,
            updatedAt: new Date(),
          });

          // Register for Background Sync to retry later
          event.waitUntil(registerBackgroundSync());

          return response;
        }
      } catch (networkError) {
        // Network error - queue for retry
        console.log("SW: Network error, queuing for retry");
        await db.bookmarks.update(queueId, {
          status: "queued",
          lastError: networkError instanceof Error ? networkError.message : "Network error",
          updatedAt: new Date(),
        });

        // Register for Background Sync
        event.waitUntil(registerBackgroundSync());

        // Return synthetic success response (queued)
        return new Response(JSON.stringify({ success: true, queued: true }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      // Offline - queue for later
      console.log("SW: Offline, queuing bookmark");
      await db.bookmarks.update(queueId, {
        status: "queued",
        updatedAt: new Date(),
      });

      // Register for Background Sync
      event.waitUntil(registerBackgroundSync());

      // Return synthetic success response (queued)
      return new Response(JSON.stringify({ success: true, queued: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("SW: Error handling bookmark request:", error);
    return new Response(JSON.stringify({ success: false, error: "Failed to process request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// =============================================================================
// Background Sync
// =============================================================================

async function registerBackgroundSync(): Promise<void> {
  try {
    const registration = self.registration;
    if ("sync" in registration) {
      await registration.sync.register("bookmark-sync");
      console.log("SW: Background Sync registered");
    }
  } catch (error) {
    console.error("SW: Failed to register Background Sync:", error);
  }
}

// Track ongoing sync to prevent duplicate execution
let syncInProgress = false;

self.addEventListener("sync", (event: SyncEvent) => {
  if (event.tag === "bookmark-sync") {
    console.log("SW: Background Sync triggered");
    event.waitUntil(
      (async () => {
        if (syncInProgress) {
          console.log("SW: Sync already in progress, skipping");
          return;
        }
        syncInProgress = true;
        try {
          await processQueue();
        } finally {
          syncInProgress = false;
        }
      })(),
    );
  }
});

// Message listener for manual sync (fallback for browsers without Background Sync)
self.addEventListener("message", (event: SWMessageEvent) => {
  const data = event.data as { type?: string } | null;
  if (data?.type === "sync-now") {
    console.log("SW: Manual sync requested via message");
    event.waitUntil(
      (async () => {
        if (syncInProgress) {
          console.log("SW: Sync already in progress, skipping");
          return;
        }
        syncInProgress = true;
        try {
          await processQueue();
        } finally {
          syncInProgress = false;
        }
      })(),
    );
  }
});

// =============================================================================
// Queue Processing (for Background Sync and retries)
// =============================================================================

// Time after which a "sending" item is considered stuck (2 minutes)
const SENDING_TIMEOUT_MS = 2 * 60 * 1000;

async function processQueue(): Promise<void> {
  const now = Date.now();

  // First, reset any stuck "sending" items back to "queued"
  const stuckItems = await db.bookmarks
    .where("status")
    .equals("sending")
    .filter((item) => {
      const updatedAtTime =
        item.updatedAt instanceof Date
          ? item.updatedAt.getTime()
          : new Date(item.updatedAt).getTime();
      return now - updatedAtTime > SENDING_TIMEOUT_MS;
    })
    .toArray();

  for (const stuckItem of stuckItems) {
    if (stuckItem.id) {
      console.log(`SW: Resetting stuck item ${stuckItem.id} from sending to queued`);
      await db.bookmarks.update(stuckItem.id, {
        status: "queued",
        lastError: "Request timed out or was interrupted",
        updatedAt: new Date(),
      });
    }
  }

  // Get items that need to be sent
  const items = await db.bookmarks
    .where("status")
    .anyOf("queued", "error")
    .filter((item) => {
      if (item.status === "queued") return true;
      if (item.status === "error" && item.nextRetryAt) {
        return now >= item.nextRetryAt;
      }
      return false;
    })
    .toArray();

  console.log(`SW: Processing ${items.length} queued items`);

  for (const item of items) {
    if (!item.id) continue;

    try {
      // Update status to sending
      await db.bookmarks.update(item.id, {
        status: "sending",
        updatedAt: new Date(),
      });

      // Send to server (bypass SW fetch handler by using full URL)
      const response = await fetch(new URL("/api/habu/bookmark", self.location.origin).href, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          url: item.url,
          title: item.title,
          comment: item.comment,
        }),
      });

      const result = (await response.json()) as BookmarkApiResponse;

      if (result.success && !result.queued) {
        // Success - update status to done and store generated content
        await db.bookmarks.update(item.id, {
          status: "done",
          updatedAt: new Date(),
          generatedComment: result.generatedComment,
          generatedSummary: result.generatedSummary,
          generatedTags: result.generatedTags,
        });
        console.log(`SW: Successfully sent bookmark ${item.id}`);
      } else {
        const retryCount = (item.retryCount || 0) + 1;
        const retryDelays = [60000, 300000, 900000, 3600000]; // 1min, 5min, 15min, 60min
        const delay = retryDelays[Math.min(retryCount - 1, retryDelays.length - 1)];

        await db.bookmarks.update(item.id, {
          status: "error",
          lastError: result.error || "Unknown error",
          retryCount,
          nextRetryAt: Date.now() + delay,
          updatedAt: new Date(),
        });
        console.log(`SW: Bookmark ${item.id} failed, will retry in ${delay / 1000}s`);
      }
    } catch (error) {
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
      console.error(`SW: Error processing bookmark ${item.id}:`, error);
    }
  }

  // Check if there are processable items remaining (queued, or error with nextRetryAt in the past)
  const processableItems = await db.bookmarks
    .where("status")
    .anyOf("queued", "error")
    .filter((item) => {
      if (item.status === "queued") return true;
      if (item.status === "error" && item.nextRetryAt) {
        return Date.now() >= item.nextRetryAt;
      }
      return false;
    })
    .count();

  if (processableItems > 0) {
    console.log(`SW: ${processableItems} processable items remaining, scheduling next sync`);
    await registerBackgroundSync();
  }
}
