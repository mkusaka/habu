"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/queue-db";
import { saveBookmark } from "@/lib/bookmark-client";
import { cleanUrl } from "@/lib/url-cleaner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BookmarksResponse } from "@/app/api/habu/bookmarks/route";

const PAGE_SIZE = 20;

interface BulkRegenerateButtonProps {
  page: number;
}

export function BulkRegenerateButton({ page }: BulkRegenerateButtonProps) {
  const router = useRouter();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [bookmarkUrls, setBookmarkUrls] = useState<string[]>([]);

  // Fetch bookmark URLs for this page to track queue status
  useEffect(() => {
    const fetchUrls = async () => {
      try {
        const offset = (page - 1) * PAGE_SIZE;
        const response = await fetch(`/api/habu/bookmarks?limit=${PAGE_SIZE}&offset=${offset}`);
        if (response.ok) {
          const data = (await response.json()) as BookmarksResponse;
          if (data.success && data.bookmarks) {
            // Use cleaned URLs to match what SW stores in IndexedDB
            setBookmarkUrls(data.bookmarks.map((b) => cleanUrl(b.url)));
          }
        }
      } catch {
        // Ignore errors for URL tracking
      }
    };
    fetchUrls();
  }, [page]);

  // Watch IndexedDB for queue status of all URLs on this page
  const queueItems = useLiveQuery(
    () => (bookmarkUrls.length > 0 ? db.bookmarks.where("url").anyOf(bookmarkUrls).toArray() : []),
    [bookmarkUrls.join(",")],
  );

  // Check if any bookmark is currently being processed
  const hasActiveItems = queueItems?.some(
    (item) => item.status === "queued" || item.status === "sending",
  );

  const isLoading = isRegenerating || hasActiveItems;

  const handleBulkRegenerate = async () => {
    setIsRegenerating(true);

    try {
      // Fetch bookmarks for this page
      const offset = (page - 1) * PAGE_SIZE;
      const response = await fetch(`/api/habu/bookmarks?limit=${PAGE_SIZE}&offset=${offset}`);

      if (!response.ok) {
        toast.error("Failed to fetch bookmarks");
        return;
      }

      const data = (await response.json()) as BookmarksResponse;

      if (!data.success || !data.bookmarks || data.bookmarks.length === 0) {
        toast.error(data.error || "No bookmarks found");
        return;
      }

      // Parallel regeneration using Promise.all
      const results = await Promise.all(
        data.bookmarks.map((bookmark) => saveBookmark(bookmark.url, bookmark.title, "")),
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
        <Button variant="ghost" size="icon" onClick={handleBulkRegenerate} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Regenerate all bookmarks on this page</TooltipContent>
    </Tooltip>
  );
}
