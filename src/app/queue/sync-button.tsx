"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, RefreshCw } from "lucide-react";
import { triggerSync } from "@/lib/bookmark-client";
import { toast } from "sonner";

export function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [swAvailable, setSwAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkSW() {
      if (!("serviceWorker" in navigator)) {
        setSwAvailable(false);
        return;
      }
      const registrations = await navigator.serviceWorker.getRegistrations();
      setSwAvailable(registrations.length > 0);
    }
    checkSW();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Sync timeout")), 5000),
      );
      await Promise.race([triggerSync(), timeoutPromise]);
      toast.success("Sync triggered");
    } catch (error) {
      console.error("handleSync: error:", error);
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSync}
          disabled={syncing || swAvailable === false}
        >
          {syncing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <RefreshCw className="w-5 h-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {swAvailable === false ? "Background sync is not available" : "Sync Now"}
      </TooltipContent>
    </Tooltip>
  );
}
