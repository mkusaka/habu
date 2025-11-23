"use client";

import { useEffect } from "react";
import { startBackgroundSync } from "@/lib/queue-sync";

export function BackgroundSync() {
  useEffect(() => {
    // Start background sync for queue
    startBackgroundSync(30); // Sync every 30 seconds
  }, []);

  return null;
}
