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

export async function deleteQueueItem(id: number): Promise<void> {
  await db.bookmarks.delete(id);
}

export async function clearCompletedItems(): Promise<void> {
  await db.bookmarks.where("status").equals("done").delete();
}

/**
 * Recover an error item by marking it as done with the bookmark data from Hatena
 */
export async function recoverErrorItem(
  id: number,
  comment?: string,
  tags?: string[],
): Promise<void> {
  await db.bookmarks.update(id, {
    status: "done",
    updatedAt: new Date(),
    lastError: undefined,
    nextRetryAt: undefined,
    retryCount: 0,
    generatedComment: comment,
    generatedSummary: comment,
    generatedTags: tags,
  });
}
