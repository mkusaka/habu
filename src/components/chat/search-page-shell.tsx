"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchPageShellProps {
  title: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}

export function SearchPageShell({
  title,
  icon: Icon,
  actions,
  description,
  children,
  bodyClassName,
}: SearchPageShellProps) {
  return (
    <div className="w-full py-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {Icon ? <Icon className="h-5 w-5 shrink-0 text-muted-foreground" /> : null}
            <h1 className="min-w-0 text-2xl font-bold tracking-tight">{title}</h1>
          </div>
          {description ? <div className="mt-2 min-w-0">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </header>

      <div className={cn("space-y-6", bodyClassName)}>{children}</div>
    </div>
  );
}
