"use client";

import type { BookmarkRequest, BookmarkResponse } from "@/types/habu";

/**
 * Save a bookmark via fetch.
 *
 * The Service Worker intercepts this request and:
 * 1. Saves to IndexedDB for UI tracking
 * 2. Attempts to send to server if online
 * 3. If offline, queues for Background Sync
 * 4. Returns synthetic response {success: true, queued: true} when offline
 *
 * @param url - The URL to bookmark
 * @param title - Optional title
 * @param comment - Optional comment
 * @returns The API response or synthetic response from SW
 */
export async function saveBookmark(
  url: string,
  title?: string,
  comment?: string,
): Promise<BookmarkResponse & { queued?: boolean }> {
  const response = await fetch("/api/habu/bookmark", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      url,
      title,
      comment,
    } as BookmarkRequest),
    keepalive: true, // Allow request to complete even if page is closed
  });

  return response.json();
}

/**
 * Trigger manual sync of queued bookmarks.
 *
 * Always uses postMessage for immediate sync, plus registers Background Sync
 * as a backup for offline scenarios.
 */
export async function triggerSync(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service Worker not supported");
    return;
  }

  const registration = await navigator.serviceWorker.ready;

  // Register Background Sync for offline backup
  if ("sync" in registration) {
    try {
      await registration.sync.register("bookmark-sync");
      console.log("Background Sync registered");
    } catch (error) {
      console.warn("Background Sync registration failed:", error);
    }
  }

  // Always use postMessage for immediate sync (Background Sync may not fire if already online)
  const controller = navigator.serviceWorker.controller;
  if (controller) {
    controller.postMessage({ type: "sync-now" });
    console.log("Immediate sync triggered via postMessage");
  } else {
    console.warn("No SW controller available for sync");
  }
}
