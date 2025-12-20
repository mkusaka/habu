"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/queue-db";
import { saveBookmark } from "@/lib/bookmark-client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BulkRegenerateButtonProps {
  bookmarks: Array<{ url: string; title: string }>;
}

export function BulkRegenerateButton({ bookmarks }: BulkRegenerateButtonProps) {
  const router = useRouter();
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Watch IndexedDB for queue status of all URLs on this page
  const urls = bookmarks.map((b) => b.url);
  const queueItems = useLiveQuery(
    () => db.bookmarks.where("url").anyOf(urls).toArray(),
    [urls.join(",")],
  );

  // Check if any bookmark is currently being processed
  const hasActiveItems = queueItems?.some(
    (item) => item.status === "queued" || item.status === "sending",
  );

  const isLoading = isRegenerating || hasActiveItems;

  const handleBulkRegenerate = async () => {
    if (bookmarks.length === 0) return;

    setIsRegenerating(true);

    try {
      // Parallel regeneration using Promise.all
      const results = await Promise.all(
        bookmarks.map((bookmark) => saveBookmark(bookmark.url, bookmark.title, "")),
      );

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      if (failCount === 0) {
        toast.success(`Queued ${successCount} bookmarks for regeneration`);
      } else {
        toast.warning(`Queued ${successCount}, failed ${failCount}`);
      }

      router.refresh();
    } catch (error) {
      console.error("Bulk regenerate failed:", error);
      toast.error("Bulk regeneration failed");
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBulkRegenerate}
          disabled={isLoading || bookmarks.length === 0}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <Sparkles className="w-4 h-4 mr-1" />
          )}
          Regenerate All
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Regenerate AI summary/tags for all {bookmarks.length} bookmarks
      </TooltipContent>
    </Tooltip>
  );
}
