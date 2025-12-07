"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveBookmark } from "@/lib/bookmark-client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RegenerateButtonProps {
  url: string;
  title?: string;
}

export function RegenerateButton({ url, title }: RegenerateButtonProps) {
  const router = useRouter();
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
        // Refresh the page to show updated data
        router.refresh();
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
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="cursor-pointer"
        >
          {isRegenerating ? (
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
