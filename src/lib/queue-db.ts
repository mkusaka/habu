import Dexie, { type EntityTable } from "dexie";
import type { BookmarkQueue } from "@/types/habu";

// Dexie database for bookmark queue
class HabuDatabase extends Dexie {
  bookmarks!: EntityTable<BookmarkQueue, "id">;

  constructor() {
    super("habu");
    this.version(1).stores({
      bookmarks: "++id, url, status, createdAt, nextRetryAt",
    });
  }
}

export const db = new HabuDatabase();

// Queue operations
export async function addToQueue(url: string, title?: string, comment?: string): Promise<number> {
  const now = new Date();
  const id = await db.bookmarks.add({
    url,
    title,
    comment,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
  });
  return id as number;
}

export async function getQueuedItems(): Promise<BookmarkQueue[]> {
  return db.bookmarks
    .where("status")
    .equals("queued")
    .or("status")
    .equals("error")
    .or("status")
    .equals("sending")
    .filter((item) => {
      // Only return items that are ready for retry
      if (item.status === "error" && item.nextRetryAt) {
        return new Date() >= item.nextRetryAt;
      }
      // Reset stuck "sending" items (older than 2 minutes)
      if (item.status === "sending") {
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        return item.updatedAt < twoMinutesAgo;
      }
      return true;
    })
    .toArray();
}

export async function getAllItems(): Promise<BookmarkQueue[]> {
  return db.bookmarks.orderBy("createdAt").reverse().toArray();
}

export async function updateQueueStatus(
  id: number,
  status: BookmarkQueue["status"],
  error?: string,
): Promise<void> {
  const updates: Partial<BookmarkQueue> = {
    status,
    updatedAt: new Date(),
  };

  if (error) {
    updates.lastError = error;
    // Exponential backoff: retry after 1min, 5min, 15min, etc.
    const item = await db.bookmarks.get(id);
    if (item) {
      const retryCount = item.retryCount + 1;
      updates.retryCount = retryCount;
      const delayMinutes = Math.min(60, Math.pow(2, retryCount - 1) * 5);
      updates.nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    }
  } else if (status === "done") {
    updates.lastError = undefined;
    updates.nextRetryAt = undefined;
  }

  await db.bookmarks.update(id, updates);
}

export async function deleteQueueItem(id: number): Promise<void> {
  await db.bookmarks.delete(id);
}

export async function retryQueueItem(id: number): Promise<void> {
  await db.bookmarks.update(id, {
    status: "queued",
    updatedAt: new Date(),
    lastError: undefined,
    nextRetryAt: undefined,
    retryCount: 0,
  });
}

export async function clearCompletedItems(): Promise<void> {
  await db.bookmarks.where("status").equals("done").delete();
}
