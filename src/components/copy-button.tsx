"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

interface CopyButtonProps {
  text: string;
  label: string;
  className?: string;
}

export function CopyButton({ text, label, className }: CopyButtonProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={className ?? "text-muted-foreground hover:text-foreground"}
      title={`Copy ${label}`}
    >
      <Copy className="w-4 h-4" />
    </button>
  );
}
