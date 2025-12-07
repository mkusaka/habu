"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
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
    <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isPending}>
      <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
    </Button>
  );
}
