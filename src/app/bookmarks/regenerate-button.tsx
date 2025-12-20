"use client";

import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/queue-db";
import { saveBookmark } from "@/lib/bookmark-client";
import { cleanUrl } from "@/lib/url-cleaner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RegenerateButtonProps {
  url: string;
  title?: string;
}

export function RegenerateButton({ url, title }: RegenerateButtonProps) {
  const router = useRouter();
  const cleanedUrl = cleanUrl(url);

  // Watch IndexedDB for this URL's queue status (use cleaned URL to match SW's storage)
  const queueItem = useLiveQuery(
    () => db.bookmarks.where("url").equals(cleanedUrl).first(),
    [cleanedUrl],
  );

  // Loading if queued or sending
  const isLoading = queueItem?.status === "queued" || queueItem?.status === "sending";

  const handleRegenerate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      // Use saveBookmark to queue with no comment (triggers AI generation)
      const result = await saveBookmark(url, title || "", "");

      if (result.success) {
        toast.success(result.queued ? "Queued for regeneration" : "Regenerated!");
        // Refresh the page to show updated data
        router.refresh();
      } else {
        toast.error(result.error || "Regenerate failed");
      }
    } catch (error) {
      console.error("Regenerate failed:", error);
      toast.error("Regenerate failed");
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRegenerate}
          disabled={isLoading}
          className="cursor-pointer"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Regenerate</TooltipContent>
    </Tooltip>
  );
}
