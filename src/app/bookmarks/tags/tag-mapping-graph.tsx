"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { TagMappingAction } from "@/types/habu";

export interface MappingGraphRow {
  sourceTag: string;
  sourceCount: number;
  action: TagMappingAction;
  targetTag?: string;
  targetCount?: number;
}

interface EdgePosition {
  sourceTag: string;
  targetKey: string;
  path: string;
  action: TagMappingAction;
}

function getTargetMeta(row: MappingGraphRow) {
  if (row.action === "delete") {
    return { key: "__delete__", label: "Delete", count: 0, action: row.action };
  }

  const label = row.action === "update" ? row.targetTag || row.sourceTag : row.sourceTag;
  return {
    key: label.toLowerCase(),
    label,
    count: row.targetCount ?? 0,
    action: row.action,
  };
}

export function TagMappingGraph({ rows }: { rows: MappingGraphRow[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const targetRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [edges, setEdges] = useState<EdgePosition[]>([]);

  const targetNodes = useMemo(() => {
    const deduped = new Map<
      string,
      { key: string; label: string; count: number; action: TagMappingAction; order: number }
    >();

    rows.forEach((row, index) => {
      const target = getTargetMeta(row);
      const existing = deduped.get(target.key);
      if (!existing) {
        deduped.set(target.key, { ...target, order: index });
        return;
      }
      if (index < existing.order) {
        existing.order = index;
      }
      existing.count = Math.max(existing.count, target.count);
    });

    return [...deduped.values()].sort((a, b) => a.order - b.order);
  }, [rows]);

  useEffect(() => {
    const computeEdges = () => {
      const container = containerRef.current;
      if (!container) return;

      const bounds = container.getBoundingClientRect();
      const nextEdges: EdgePosition[] = [];

      for (const row of rows) {
        const sourceEl = sourceRefs.current[row.sourceTag];
        const target = getTargetMeta(row);
        const targetEl = targetRefs.current[target.key];
        if (!sourceEl || !targetEl) continue;

        const sourceBounds = sourceEl.getBoundingClientRect();
        const targetBounds = targetEl.getBoundingClientRect();
        const startX = sourceBounds.right - bounds.left;
        const startY = sourceBounds.top + sourceBounds.height / 2 - bounds.top;
        const endX = targetBounds.left - bounds.left;
        const endY = targetBounds.top + targetBounds.height / 2 - bounds.top;
        const midX = startX + (endX - startX) / 2;
        const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

        nextEdges.push({
          sourceTag: row.sourceTag,
          targetKey: target.key,
          path,
          action: row.action,
        });
      }

      setEdges(nextEdges);
    };

    computeEdges();
    const observer = new ResizeObserver(computeEdges);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener("resize", computeEdges);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", computeEdges);
    };
  }, [rows, targetNodes]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-lg border bg-muted/20 p-4">
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {edges.map((edge) => (
          <path
            key={`${edge.sourceTag}-${edge.targetKey}`}
            d={edge.path}
            fill="none"
            stroke={
              edge.action === "delete"
                ? "rgb(239 68 68 / 0.45)"
                : edge.action === "update"
                  ? "rgb(59 130 246 / 0.45)"
                  : "rgb(148 163 184 / 0.35)"
            }
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}
      </svg>

      <div className="relative grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Before
          </div>
          {rows.map((row) => (
            <div
              key={row.sourceTag}
              ref={(element) => {
                sourceRefs.current[row.sourceTag] = element;
              }}
              className="flex min-h-10 items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
            >
              <span className="font-medium">{row.sourceTag}</span>
              <span className="text-xs text-muted-foreground">{row.sourceCount}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            After
          </div>
          {targetNodes.map((target) => (
            <div
              key={target.key}
              ref={(element) => {
                targetRefs.current[target.key] = element;
              }}
              className={cn(
                "flex min-h-10 items-center justify-between rounded-md border px-3 py-2 text-sm shadow-sm",
                target.action === "delete"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
                  : "bg-background",
              )}
            >
              <span className="font-medium">{target.label}</span>
              {target.action !== "delete" && (
                <span className="text-xs text-muted-foreground">{target.count}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
