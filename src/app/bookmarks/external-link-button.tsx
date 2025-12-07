"use client";

import { ExternalLink } from "lucide-react";

interface ExternalLinkButtonProps {
  href: string;
}

export function ExternalLinkButton({ href }: ExternalLinkButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-muted-foreground hover:text-foreground flex-shrink-0"
    >
      <ExternalLink className="w-4 h-4" />
    </a>
  );
}
