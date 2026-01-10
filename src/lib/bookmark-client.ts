"use client";

import type { BookmarkRequest, BookmarkResponse } from "@/types/habu";
import { cleanUrl } from "@/lib/url-cleaner";

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
 * @param skipAiGeneration - Skip AI generation even when no comment is provided
 * @returns The API response or synthetic response from SW
 */
export async function saveBookmark(
  url: string,
  title?: string,
  comment?: string,
  skipAiGeneration?: boolean,
): Promise<BookmarkResponse & { queued?: boolean }> {
  const cleanedUrl = cleanUrl(url);
  const response = await fetch("/api/habu/bookmark", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      url: cleanedUrl,
      title,
      comment,
      skipAiGeneration,
    } as BookmarkRequest),
    keepalive: true, // Allow request to complete even if page is closed
  });

  return response.json();
}

/**
 * Fire-and-forget bookmark saving.
 *
 * Uses keepalive to ensure the request completes even if the page is closed.
 * Does not wait for response - ideal for auto-save scenarios where user
 * wants to quickly save and close the window.
 *
 * @param url - The URL to bookmark
 * @param title - Optional title
 * @param comment - Optional comment
 * @param skipAiGeneration - Skip AI generation even when no comment is provided
 */
export function queueBookmark(
  url: string,
  title?: string,
  comment?: string,
  skipAiGeneration?: boolean,
): void {
  const cleanedUrl = cleanUrl(url);
  fetch("/api/habu/bookmark", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      url: cleanedUrl,
      title,
      comment,
      skipAiGeneration,
    } as BookmarkRequest),
    keepalive: true,
  });
}

/**
 * Trigger manual sync of queued bookmarks.
 *
 * Always uses postMessage for immediate sync, plus registers Background Sync
 * as a backup for offline scenarios.
 */
export async function triggerSync(): Promise<void> {
  console.log("triggerSync: start");
  if (!("serviceWorker" in navigator)) {
    console.warn("triggerSync: Service Worker not supported");
    return;
  }

  // Check if there's an active SW registration first
  const registrations = await navigator.serviceWorker.getRegistrations();
  console.log("triggerSync: found", registrations.length, "registrations");

  if (registrations.length === 0) {
    console.warn("triggerSync: No Service Worker registered");
    return;
  }

  // Use the first registration (should be our SW)
  const registration = registrations[0];

  // Register Background Sync for offline backup
  if ("sync" in registration) {
    try {
      await registration.sync.register("bookmark-sync");
      console.log("triggerSync: Background Sync registered");
    } catch (error) {
      console.warn("triggerSync: Background Sync registration failed:", error);
    }
  }

  // Always use postMessage for immediate sync (Background Sync may not fire if already online)
  const controller = navigator.serviceWorker.controller;
  if (controller) {
    controller.postMessage({ type: "sync-now" });
    console.log("triggerSync: postMessage sent");
  } else {
    console.warn("triggerSync: No SW controller available for sync");
  }
  console.log("triggerSync: end");
}
