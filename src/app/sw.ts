import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";
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

interface SWNotificationEvent extends ExtendableEvent {
  readonly notification: Notification;
  readonly action: string;
}

interface WindowClient {
  readonly url: string;
  focus(): Promise<WindowClient>;
  navigate(url: string): Promise<WindowClient | null>;
  postMessage(message: unknown): void;
}

interface Clients {
  matchAll(options?: { type?: string; includeUncontrolled?: boolean }): Promise<WindowClient[]>;
  openWindow(url: string): Promise<WindowClient | null>;
}

declare global {
  interface ServiceWorkerGlobalScope {
    addEventListener(type: "sync", listener: (event: SyncEvent) => void): void;
    addEventListener(type: "fetch", listener: (event: FetchEvent) => void): void;
    addEventListener(type: "message", listener: (event: SWMessageEvent) => void): void;
    addEventListener(
      type: "notificationclick",
      listener: (event: SWNotificationEvent) => void,
    ): void;
    readonly registration: ServiceWorkerRegistration;
    readonly location: { origin: string };
    readonly clients: Clients;
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
  cacheId: process.env.NEXT_PUBLIC_GIT_SHA ?? "habu",
  runtimeCaching: [
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && (url.pathname === "/manifest.json" || url.pathname === "/manifest-dark.json"),
      method: "GET",
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
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
  // Skip AI generation even when no comment is provided
  skipAiGeneration?: boolean;
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
    const body = (await request.json()) as {
      url: string;
      title?: string;
      comment?: string;
      skipAiGeneration?: boolean;
    };

    // Check if URL already exists in IndexedDB
    const existingItem = await db.bookmarks.where("url").equals(body.url).first();

    let queueId: number;

    if (existingItem && existingItem.id) {
      // Reuse existing entry - update it with new data and reset status
      queueId = existingItem.id;
      await db.bookmarks.update(queueId, {
        title: body.title ?? existingItem.title,
        comment: body.comment ?? existingItem.comment,
        skipAiGeneration: body.skipAiGeneration,
        status: "sending",
        updatedAt: new Date(),
        lastError: undefined,
        nextRetryAt: undefined,
        retryCount: 0,
      });
      console.log(`SW: Reusing existing bookmark entry ${queueId} for URL: ${body.url}`);
    } else {
      // Create new entry
      queueId = await db.bookmarks.add({
        url: body.url,
        title: body.title,
        comment: body.comment,
        skipAiGeneration: body.skipAiGeneration,
        status: "sending",
        createdAt: new Date(),
        updatedAt: new Date(),
        retryCount: 0,
      });
      console.log(`SW: Created new bookmark entry ${queueId} for URL: ${body.url}`);
    }

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
          // Success - update status to done and store generated content, clear error
          await db.bookmarks.update(queueId, {
            status: "done",
            updatedAt: new Date(),
            lastError: undefined,
            nextRetryAt: undefined,
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

// Notify all clients of bookmark status changes
async function notifyClients(message: {
  type: "bookmark-error" | "bookmark-success";
  url: string;
  title?: string;
  error?: string;
}): Promise<void> {
  try {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage(message);
    }
  } catch (error) {
    console.error("SW: Failed to notify clients:", error);
  }
}

// Show push notification for errors
async function showErrorNotification(
  title: string,
  errorMessage: string,
  url?: string,
): Promise<void> {
  try {
    const permission = Notification.permission;
    if (permission !== "granted") {
      console.log("SW: Notification permission not granted");
      return;
    }

    await self.registration.showNotification(title, {
      body: errorMessage,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      tag: "bookmark-error",
      data: { url, action: "open-queue" },
      requireInteraction: false,
    });
  } catch (error) {
    console.error("SW: Failed to show notification:", error);
  }
}

// Handle notification click - open queue page
self.addEventListener("notificationclick", (event: SWNotificationEvent) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Try to find existing PWA window and navigate to queue
      for (const client of windowClients) {
        await client.focus();
        // Navigate to queue page if not already there
        if (!client.url.includes("/queue")) {
          await client.navigate("/queue");
        }
        return;
      }

      // No existing window - open queue page (will open in PWA if installed)
      await self.clients.openWindow("/queue");
    })(),
  );
});

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

  console.log(`SW: Processing ${items.length} queued items in parallel`);

  // Mark all items as sending first
  await Promise.all(
    items
      .filter((item) => item.id)
      .map((item) =>
        db.bookmarks.update(item.id!, {
          status: "sending",
          updatedAt: new Date(),
        }),
      ),
  );

  // Process all items in parallel (using allSettled to handle individual failures gracefully)
  const results = await Promise.allSettled(
    items
      .filter((item) => item.id)
      .map(async (item) => {
        try {
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
              skipAiGeneration: item.skipAiGeneration,
            }),
          });

          const result = (await response.json()) as BookmarkApiResponse;

          if (result.success && !result.queued) {
            // Success - update status to done and store generated content, clear error
            await db.bookmarks.update(item.id!, {
              status: "done",
              updatedAt: new Date(),
              lastError: undefined,
              nextRetryAt: undefined,
              generatedComment: result.generatedComment,
              generatedSummary: result.generatedSummary,
              generatedTags: result.generatedTags,
            });
            console.log(`SW: Successfully sent bookmark ${item.id}`);
          } else {
            const retryCount = (item.retryCount || 0) + 1;
            const retryDelays = [60000, 300000, 900000, 3600000]; // 1min, 5min, 15min, 60min
            const delay = retryDelays[Math.min(retryCount - 1, retryDelays.length - 1)];

            await db.bookmarks.update(item.id!, {
              status: "error",
              lastError: result.error || "Unknown error",
              retryCount,
              nextRetryAt: Date.now() + delay,
              updatedAt: new Date(),
            });
            console.log(`SW: Bookmark ${item.id} failed, will retry in ${delay / 1000}s`);

            // Notify clients and show error notification
            await notifyClients({
              type: "bookmark-error",
              url: item.url,
              title: item.title,
              error: result.error || "Unknown error",
            });
            await showErrorNotification(
              "Bookmark failed",
              result.error || "Unknown error",
              item.url,
            );
          }
        } catch (error) {
          const retryCount = (item.retryCount || 0) + 1;
          const retryDelays = [60000, 300000, 900000, 3600000];
          const delay = retryDelays[Math.min(retryCount - 1, retryDelays.length - 1)];
          const errorMessage = error instanceof Error ? error.message : "Network error";

          try {
            await db.bookmarks.update(item.id!, {
              status: "error",
              lastError: errorMessage,
              retryCount,
              nextRetryAt: Date.now() + delay,
              updatedAt: new Date(),
            });
          } catch (dbError) {
            console.error(`SW: Failed to update error status for bookmark ${item.id}:`, dbError);
          }
          console.error(`SW: Error processing bookmark ${item.id}:`, error);

          // Notify clients and show error notification
          await notifyClients({
            type: "bookmark-error",
            url: item.url,
            title: item.title,
            error: errorMessage,
          });
          await showErrorNotification("Bookmark failed", errorMessage, item.url);
        }
      }),
  );

  // Log summary
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.log(`SW: Processed ${succeeded} succeeded, ${failed} failed`);
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
