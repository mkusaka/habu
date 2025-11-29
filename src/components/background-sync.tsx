"use client";

import { useEffect } from "react";
import { triggerSync } from "@/lib/queue-sync";

/**
 * Fallback sync trigger for browsers without Background Sync API (e.g., Safari).
 *
 * Listens for:
 * - online event: triggers sync when browser comes back online
 * - visibilitychange: triggers sync when user returns to the tab
 */
export function BackgroundSyncFallback() {
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
