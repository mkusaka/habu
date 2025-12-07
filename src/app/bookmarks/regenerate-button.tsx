"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveBookmark } from "@/lib/bookmark-client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RegenerateButtonProps {
  url: string;
  title?: string;
}

export function RegenerateButton({ url, title }: RegenerateButtonProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsRegenerating(true);

    try {
      // Use saveBookmark to queue with no comment (triggers AI generation)
      const result = await saveBookmark(url, title || "", "");

      if (result.success) {
        toast.success(result.queued ? "Queued for regeneration" : "Regenerated!");
      } else {
        toast.error(result.error || "Regenerate failed");
      }
    } catch (error) {
      console.error("Regenerate failed:", error);
      toast.error("Regenerate failed");
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="relative z-10">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="p-1 text-muted-foreground hover:text-primary disabled:opacity-50 flex-shrink-0 cursor-pointer"
          >
            {isRegenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>Regenerate</TooltipContent>
      </Tooltip>
    </div>
  );
}
