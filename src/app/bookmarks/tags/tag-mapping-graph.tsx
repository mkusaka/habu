"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
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

function buildHatenaTagPageUrl(hatenaId: string, tag: string) {
  return `https://b.hatena.ne.jp/${encodeURIComponent(hatenaId)}/${encodeURIComponent(tag)}/`;
}

export function TagMappingGraph({
  rows,
  hatenaId,
}: {
  rows: MappingGraphRow[];
  hatenaId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRefs = useRef<Record<string, HTMLElement | null>>({});
  const targetRefs = useRef<Record<string, HTMLElement | null>>({});
  const [edges, setEdges] = useState<EdgePosition[]>([]);
  const [laneWidths, setLaneWidths] = useState({ source: 0, target: 0 });

  const handleCopyTarget = async (label: string, action: TagMappingAction) => {
    if (action === "delete") return;

    try {
      await navigator.clipboard.writeText(label);
      toast.success("Tag copied", { description: label });
    } catch {
      toast.error("Failed to copy");
    }
  };

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
      let nextSourceWidth = 0;
      let nextTargetWidth = 0;

      for (const row of rows) {
        const sourceEl = sourceRefs.current[row.sourceTag];
        const target = getTargetMeta(row);
        const targetEl = targetRefs.current[target.key];
        if (!sourceEl || !targetEl) continue;

        const sourceBounds = sourceEl.getBoundingClientRect();
        const targetBounds = targetEl.getBoundingClientRect();
        nextSourceWidth = Math.max(nextSourceWidth, Math.ceil(sourceBounds.width));
        nextTargetWidth = Math.max(nextTargetWidth, Math.ceil(targetBounds.width));
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
      setLaneWidths((current) => {
        const source = Math.max(nextSourceWidth, 136);
        const target = Math.max(nextTargetWidth, 136);
        if (current.source === source && current.target === target) {
          return current;
        }
        return { source, target };
      });
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

  const horizontalPadding = 24;
  const columnGap = 16;
  const graphWidth =
    laneWidths.source > 0 && laneWidths.target > 0
      ? laneWidths.source + laneWidths.target + columnGap + horizontalPadding
      : undefined;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div
        ref={containerRef}
        className="relative bg-muted/20 p-3 sm:p-4"
        style={graphWidth ? { width: `${graphWidth}px`, minWidth: `${graphWidth}px` } : undefined}
      >
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

        <div
          className="relative grid gap-4"
          style={{
            gridTemplateColumns: `${Math.max(laneWidths.source, 136)}px ${Math.max(
              laneWidths.target,
              136,
            )}px`,
          }}
        >
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Before
            </div>
            {rows.map((row) => (
              <a
                key={row.sourceTag}
                href={hatenaId ? buildHatenaTagPageUrl(hatenaId, row.sourceTag) : undefined}
                target={hatenaId ? "_blank" : undefined}
                rel={hatenaId ? "noopener noreferrer" : undefined}
                ref={(element) => {
                  sourceRefs.current[row.sourceTag] = element;
                }}
                className={cn(
                  "flex min-h-10 items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors",
                  hatenaId ? "cursor-pointer hover:bg-accent/40" : "cursor-default",
                )}
                title={hatenaId ? `Open Hatena bookmarks tagged ${row.sourceTag}` : undefined}
              >
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <span className="truncate">{row.sourceTag}</span>
                  {hatenaId && <ExternalLink className="size-3 shrink-0 text-muted-foreground" />}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{row.sourceCount}</span>
              </a>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              After
            </div>
            {targetNodes.map((target) => (
              <button
                type="button"
                key={target.key}
                onClick={() => void handleCopyTarget(target.label, target.action)}
                ref={(element) => {
                  targetRefs.current[target.key] = element;
                }}
                className={cn(
                  "flex min-h-10 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm shadow-sm transition-colors",
                  target.action === "delete"
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
                    : "cursor-pointer bg-background hover:bg-accent/40",
                )}
                title={target.action === "delete" ? undefined : `Copy ${target.label}`}
              >
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <span className="truncate">{target.label}</span>
                  {target.action !== "delete" && (
                    <Copy className="size-3 shrink-0 text-muted-foreground" />
                  )}
                </span>
                {target.action !== "delete" ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{target.count}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
