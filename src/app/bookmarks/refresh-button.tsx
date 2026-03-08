"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw } from "lucide-react";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isPending}
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Refresh</TooltipContent>
    </Tooltip>
  );
}
