"use client";

import { useEffect } from "react";
import { triggerSync } from "@/lib/queue-sync";
import { toast } from "sonner";

interface SWMessage {
  type: "bookmark-error" | "bookmark-success";
  url: string;
  title?: string;
  error?: string;
}

/**
 * Handles background sync fallback and Service Worker messages.
 *
 * Listens for:
 * - online event: triggers sync when browser comes back online
 * - visibilitychange: triggers sync when user returns to the tab
 * - SW messages: shows toast notifications for bookmark errors/success
 */
export function BackgroundSyncFallback() {
  // Listen for SW messages
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent<SWMessage>) => {
      const { type, title, url, error } = event.data;

      if (type === "bookmark-error") {
        toast.error("Bookmark failed", {
          description: `${title || url}: ${error}`,
        });
      } else if (type === "bookmark-success") {
        toast.success("Bookmark saved", {
          description: title || url,
        });
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);

  // Fallback sync for browsers without Background Sync API
  useEffect(() => {
    // Check if Background Sync is supported
    const hasBackgroundSync =
      "serviceWorker" in navigator && "sync" in ServiceWorkerRegistration.prototype;

    // If Background Sync is supported, we don't need this fallback
    if (hasBackgroundSync) {
      return;
    }

    console.log("Background Sync not supported, enabling fallback sync triggers");

    const handleOnline = () => {
      console.log("Online event detected, triggering sync");
      triggerSync().catch(console.error);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("Tab became visible, triggering sync");
        triggerSync().catch(console.error);
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Also trigger sync on mount if online
    if (navigator.onLine) {
      triggerSync().catch(console.error);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
