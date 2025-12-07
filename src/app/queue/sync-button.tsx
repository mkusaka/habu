"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, RefreshCw } from "lucide-react";
import { triggerSync } from "@/lib/queue-sync";
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
        <span className="flex-1">
          <Button
            onClick={handleSync}
            disabled={syncing || swAvailable === false}
            className="w-full"
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        </span>
      </TooltipTrigger>
      {swAvailable === false && <TooltipContent>Background sync is not available</TooltipContent>}
    </Tooltip>
  );
}
