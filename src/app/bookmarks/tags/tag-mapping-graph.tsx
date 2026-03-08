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
  const [selection, setSelection] = useState<{ sourceTag?: string; targetKey: string } | null>(
    null,
  );

  const handleCopyTarget = async (label: string, action: TagMappingAction) => {
    if (action === "delete") return;

    try {
      await navigator.clipboard.writeText(label);
      toast.success("Tag copied", { description: label });
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleSelectSource = (row: MappingGraphRow) => {
    const target = getTargetMeta(row);
    setSelection((current) =>
      current?.sourceTag === row.sourceTag
        ? null
        : { sourceTag: row.sourceTag, targetKey: target.key },
    );
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

  const hasSelection = selection !== null;

  const isEdgeHighlighted = (edge: EdgePosition) => {
    if (!selection) return true;
    if (selection.sourceTag) {
      return edge.sourceTag === selection.sourceTag && edge.targetKey === selection.targetKey;
    }
    return edge.targetKey === selection.targetKey;
  };

  return (
    <div className="overflow-x-auto rounded-lg border md:overflow-x-visible">
      <div
        ref={containerRef}
        className="relative w-max min-w-full bg-muted/20 p-3 md:mx-auto md:w-full md:min-w-0 md:max-w-[860px] md:p-4"
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
              strokeWidth={isEdgeHighlighted(edge) ? "3" : "2"}
              strokeLinecap="round"
              opacity={hasSelection ? (isEdgeHighlighted(edge) ? 1 : 0.18) : 1}
            />
          ))}
        </svg>

        <div className="relative grid grid-cols-[minmax(8rem,max-content)_minmax(8rem,max-content)] justify-between gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Before
            </div>
            {rows.map((row) => {
              const target = getTargetMeta(row);
              const isHighlighted =
                selection?.sourceTag === row.sourceTag ||
                (!selection?.sourceTag && selection?.targetKey === target.key);
              const isDimmed = hasSelection && !isHighlighted;

              return (
                <button
                  type="button"
                  key={row.sourceTag}
                  onClick={() => handleSelectSource(row)}
                  aria-pressed={selection?.sourceTag === row.sourceTag}
                  ref={(element) => {
                    sourceRefs.current[row.sourceTag] = element;
                  }}
                  className={cn(
                    "flex min-h-10 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-all",
                    isHighlighted && "border-primary bg-primary/10 ring-1 ring-primary/40",
                    isDimmed && "opacity-35",
                    !hasSelection && "hover:bg-accent/40",
                  )}
                  title={`Highlight ${row.sourceTag}`}
                >
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span className="truncate">{row.sourceTag}</span>
                    {hatenaId ? (
                      <a
                        href={buildHatenaTagPageUrl(hatenaId, row.sourceTag)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        title={`Open Hatena bookmarks tagged ${row.sourceTag}`}
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{row.sourceCount}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              After
            </div>
            {targetNodes.map((target) => {
              const isHighlighted = selection?.targetKey === target.key;
              const isDimmed = hasSelection && selection?.targetKey !== target.key;

              return (
                <div
                  key={target.key}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelection((current) =>
                      current?.sourceTag === undefined && current?.targetKey === target.key
                        ? null
                        : { targetKey: target.key },
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelection((current) =>
                        current?.sourceTag === undefined && current?.targetKey === target.key
                          ? null
                          : { targetKey: target.key },
                      );
                    }
                  }}
                  ref={(element) => {
                    targetRefs.current[target.key] = element;
                  }}
                  className={cn(
                    "flex min-h-10 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm shadow-sm transition-all outline-none",
                    target.action === "delete"
                      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
                      : "cursor-pointer bg-background hover:bg-accent/40",
                    isHighlighted && "border-primary bg-primary/10 ring-1 ring-primary/40",
                    isDimmed && "opacity-35",
                  )}
                  title={`Highlight mappings to ${target.label}`}
                >
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span className="truncate">{target.label}</span>
                    {target.action !== "delete" ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleCopyTarget(target.label, target.action);
                        }}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        title={`Copy ${target.label}`}
                      >
                        <Copy className="size-3" />
                      </button>
                    ) : null}
                  </span>
                  {target.action !== "delete" ? (
                    <span className="shrink-0 text-xs text-muted-foreground">{target.count}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
