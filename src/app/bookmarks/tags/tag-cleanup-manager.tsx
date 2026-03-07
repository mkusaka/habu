"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, RefreshCw, GitMerge, Trash2, Equal, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TagMappingGraph, type MappingGraphRow } from "./tag-mapping-graph";
import type {
  HatenaTag,
  HatenaTagsListResponse,
  TagCleanupCandidatesResponse,
  TagCleanupResponse,
  TagMappingAction,
  TagMappingCandidate,
} from "@/types/habu";
import { cn } from "@/lib/utils";

interface MappingRow {
  sourceTag: string;
  count: number;
  action: TagMappingAction;
  targetTag: string;
  targetCount: number;
  reason?: string;
  suggested: boolean;
}

function buildDefaultRows(tags: HatenaTag[]): MappingRow[] {
  return tags.map((tag) => ({
    sourceTag: tag.tag,
    count: tag.count,
    action: "no_change",
    targetTag: tag.tag,
    targetCount: tag.count,
    suggested: false,
  }));
}

function mergeRows(
  tags: HatenaTag[],
  previousRows: MappingRow[],
  suggestions: TagMappingCandidate[] = [],
) {
  const previousMap = new Map(previousRows.map((row) => [row.sourceTag.toLowerCase(), row]));
  const suggestionMap = new Map(suggestions.map((row) => [row.sourceTag.toLowerCase(), row]));
  const countMap = new Map(tags.map((tag) => [tag.tag.toLowerCase(), tag.count]));

  return tags.map((tag) => {
    const previous = previousMap.get(tag.tag.toLowerCase());
    const suggestion = suggestionMap.get(tag.tag.toLowerCase());
    const action = suggestion?.action ?? previous?.action ?? "no_change";
    const fallbackTarget =
      action === "delete" ? "" : (suggestion?.targetTag ?? previous?.targetTag ?? tag.tag);

    return {
      sourceTag: tag.tag,
      count: tag.count,
      action,
      targetTag: fallbackTarget,
      targetCount: fallbackTarget ? (countMap.get(fallbackTarget.toLowerCase()) ?? 0) : 0,
      reason: suggestion?.reason ?? previous?.reason,
      suggested: suggestion?.suggested ?? false,
    } satisfies MappingRow;
  });
}

function toCleanupMappings(rows: MappingRow[]): TagMappingCandidate[] {
  return rows
    .filter((row) => row.action !== "no_change")
    .map((row) => ({
      sourceTag: row.sourceTag,
      action: row.action,
      targetTag: row.action === "update" ? row.targetTag.trim() : undefined,
      reason: row.reason,
      sourceCount: row.count,
      targetCount: row.targetCount,
      suggested: row.suggested,
    }))
    .filter((row) => row.action === "delete" || (row.targetTag && row.targetTag.length > 0));
}

export function TagCleanupManager() {
  const [tagInventory, setTagInventory] = useState<HatenaTag[]>([]);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [isGeneratingCandidates, setIsGeneratingCandidates] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [missingWritePrivate, setMissingWritePrivate] = useState(false);
  const [previewResult, setPreviewResult] = useState<TagCleanupResponse | null>(null);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [filterText, setFilterText] = useState("");

  const countMap = useMemo(
    () => new Map(tagInventory.map((tag) => [tag.tag.toLowerCase(), tag.count])),
    [tagInventory],
  );

  const loadTagInventory = async () => {
    setIsLoadingTags(true);
    setInventoryError(null);

    try {
      const response = await fetch("/api/habu/tags", {
        credentials: "include",
      });
      const data = (await response.json()) as HatenaTagsListResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load tags");
      }

      const tags = data.tags ?? [];
      setTagInventory(tags);
      setRows((currentRows) =>
        currentRows.length > 0 ? mergeRows(tags, currentRows) : buildDefaultRows(tags),
      );
      setMissingWritePrivate(data.missingWritePrivate ?? false);
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "Failed to load tags");
    } finally {
      setIsLoadingTags(false);
    }
  };

  useEffect(() => {
    void loadTagInventory();
  }, []);

  const handleGenerateCandidates = async () => {
    setIsGeneratingCandidates(true);

    try {
      const response = await fetch("/api/habu/tag-cleanup-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as TagCleanupCandidatesResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate candidates");
      }

      setRows((currentRows) => mergeRows(tagInventory, currentRows, data.candidates ?? []));
      setMissingWritePrivate(data.missingWritePrivate ?? false);
      setShowUnchanged(false);
      toast.success("Candidates generated");
    } catch (error) {
      toast.error("Candidate generation failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsGeneratingCandidates(false);
    }
  };

  const updateRow = (sourceTag: string, patch: Partial<MappingRow>) => {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.sourceTag !== sourceTag) return row;

        const nextTargetTag =
          patch.targetTag !== undefined
            ? patch.targetTag
            : patch.action === "delete"
              ? ""
              : patch.action === "no_change"
                ? row.sourceTag
                : row.targetTag;
        const nextAction = patch.action ?? row.action;
        const normalizedTargetTag =
          nextAction === "delete" ? "" : nextAction === "no_change" ? row.sourceTag : nextTargetTag;

        return {
          ...row,
          ...patch,
          action: nextAction,
          targetTag: normalizedTargetTag,
          targetCount: normalizedTargetTag
            ? (countMap.get(normalizedTargetTag.toLowerCase()) ?? row.targetCount)
            : 0,
          suggested: false,
        };
      }),
    );
  };

  const activeMappings = useMemo(() => toCleanupMappings(rows), [rows]);

  const filteredRows = useMemo(() => {
    const normalizedFilter = filterText.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesFilter =
        !normalizedFilter ||
        row.sourceTag.toLowerCase().includes(normalizedFilter) ||
        row.targetTag.toLowerCase().includes(normalizedFilter);
      if (!matchesFilter) return false;
      if (showUnchanged) return true;
      return row.action !== "no_change" || row.suggested;
    });
  }, [filterText, rows, showUnchanged]);

  const graphRows = useMemo<MappingGraphRow[]>(
    () =>
      filteredRows
        .filter((row) => row.action !== "no_change")
        .map((row) => ({
          sourceTag: row.sourceTag,
          sourceCount: row.count,
          action: row.action,
          targetTag: row.action === "update" ? row.targetTag.trim() : undefined,
          targetCount:
            row.action === "update" ? (countMap.get(row.targetTag.trim().toLowerCase()) ?? 0) : 0,
        })),
    [countMap, filteredRows],
  );

  const handlePreview = async () => {
    setIsPreviewing(true);

    try {
      const response = await fetch("/api/habu/tag-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "preview",
          mappings: activeMappings,
        }),
      });

      const data = (await response.json()) as TagCleanupResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to preview tag cleanup");
      }

      setPreviewResult(data);
      setMissingWritePrivate(data.missingWritePrivate ?? false);
      toast.success("Preview is ready");
    } catch (error) {
      toast.error("Preview failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleApply = async () => {
    setIsApplying(true);

    try {
      const response = await fetch("/api/habu/tag-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "apply",
          mappings: activeMappings,
        }),
      });

      const data = (await response.json()) as TagCleanupResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to apply tag cleanup");
      }

      setPreviewResult(data);
      setMissingWritePrivate(data.missingWritePrivate ?? false);
      await loadTagInventory();
      toast.success(`Updated ${data.updatedCount ?? 0} bookmarks`);
    } catch (error) {
      toast.error("Apply failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <WandSparkles className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-medium">Mapping Candidates</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Generate cleanup candidates, then choose delete, update, or no change for each tag.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateCandidates}
              disabled={isGeneratingCandidates || isLoadingTags}
            >
              {isGeneratingCandidates ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate candidates
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => void loadTagInventory()}
              disabled={isLoadingTags}
            >
              <RefreshCw className={isLoadingTags ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-2">
            <Label htmlFor="tag-filter">Filter tags</Label>
            <Input
              id="tag-filter"
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder="Search before/after tags..."
            />
          </div>
          <div className="flex items-end justify-between rounded-md border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Show unchanged</p>
              <p className="text-xs text-muted-foreground">
                Include rows still mapped to themselves
              </p>
            </div>
            <Switch checked={showUnchanged} onCheckedChange={setShowUnchanged} />
          </div>
        </div>

        {inventoryError && <p className="mt-3 text-sm text-red-500">{inventoryError}</p>}

        {missingWritePrivate && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-300">
            Your current Hatena token does not include <code>write_private</code>. Public bookmarks
            can still be updated, but private bookmark updates may fail until you reconnect Hatena.
          </p>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span>
                  Tags: <strong>{rows.length}</strong>
                </span>
                <span>
                  Active changes: <strong>{activeMappings.length}</strong>
                </span>
                <span>
                  Visible rows: <strong>{filteredRows.length}</strong>
                </span>
              </div>
            </div>

            {graphRows.length > 0 ? (
              <TagMappingGraph rows={graphRows} />
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No active mapping edges yet. Generate candidates or change a row from No change.
              </div>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-medium">Apply Workflow</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Preview matched bookmarks first, then apply the accepted mappings.
            </p>

            <div className="mt-4 space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handlePreview}
                disabled={activeMappings.length === 0 || isPreviewing}
              >
                {isPreviewing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Previewing...
                  </>
                ) : (
                  "Preview accepted mappings"
                )}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={activeMappings.length === 0 || isApplying}
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      "Apply accepted mappings"
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Apply accepted mappings</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will update every bookmark matched by the current accepted mappings.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleApply()}>Apply</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Candidate rows</h2>
            <p className="text-sm text-muted-foreground">
              Suggested rows can be edited individually before preview/apply.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {filteredRows.map((row) => (
            <div key={row.sourceTag} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{row.sourceTag}</span>
                    <span className="text-xs text-muted-foreground">{row.count}</span>
                    {row.suggested && (
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        Suggested
                      </span>
                    )}
                  </div>
                  {row.reason && <p className="mt-1 text-xs text-muted-foreground">{row.reason}</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={row.action === "delete" ? "destructive" : "outline"}
                    onClick={() => updateRow(row.sourceTag, { action: "delete", targetTag: "" })}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={row.action === "update" ? "default" : "outline"}
                    onClick={() =>
                      updateRow(row.sourceTag, {
                        action: "update",
                        targetTag: row.targetTag || row.sourceTag,
                      })
                    }
                  >
                    <GitMerge className="w-4 h-4 mr-2" />
                    Update
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={row.action === "no_change" ? "secondary" : "outline"}
                    onClick={() =>
                      updateRow(row.sourceTag, { action: "no_change", targetTag: row.sourceTag })
                    }
                  >
                    <Equal className="w-4 h-4 mr-2" />
                    No change
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <div className="text-xs text-muted-foreground">Before</div>
                  <div className="font-medium">{row.sourceTag}</div>
                </div>

                <div
                  className={cn(
                    "rounded-md px-3 py-2 text-sm",
                    row.action === "delete"
                      ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-200"
                      : "bg-muted/50",
                  )}
                >
                  <div className="text-xs text-muted-foreground">After</div>
                  {row.action === "delete" ? (
                    <div className="font-medium">Remove this tag</div>
                  ) : row.action === "no_change" ? (
                    <div className="font-medium">{row.sourceTag}</div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        list="hatena-tag-options"
                        value={row.targetTag}
                        onChange={(event) =>
                          updateRow(row.sourceTag, {
                            action: "update",
                            targetTag: event.target.value,
                          })
                        }
                        placeholder="Target tag"
                      />
                      <p className="text-xs text-muted-foreground">
                        Existing target usage:{" "}
                        {countMap.get(row.targetTag.trim().toLowerCase()) ?? 0}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredRows.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No rows match the current filter. Generate candidates or enable unchanged rows.
            </div>
          )}
        </div>
      </div>

      <datalist id="hatena-tag-options">
        {tagInventory.map((tag) => (
          <option key={tag.tag} value={tag.tag} />
        ))}
      </datalist>

      {previewResult && (
        <div className="rounded-lg border p-4">
          <div className="mb-3 space-y-1">
            <h2 className="font-medium">Preview</h2>
            <p className="text-sm text-muted-foreground">
              {previewResult.totalMatched ?? 0} bookmarks will change.
            </p>
            {previewResult.updatedCount !== undefined && (
              <p className="text-sm text-muted-foreground">
                Updated: {previewResult.updatedCount}
                {previewResult.failed && previewResult.failed.length > 0
                  ? ` / Failed: ${previewResult.failed.length}`
                  : ""}
              </p>
            )}
          </div>

          {previewResult.preview && previewResult.preview.length > 0 ? (
            <div className="space-y-2">
              {previewResult.preview.map((bookmark) => (
                <div key={bookmark.url} className="rounded-md border p-3 text-sm">
                  <div className="font-medium break-all">{bookmark.title}</div>
                  <div className="text-xs text-muted-foreground break-all">{bookmark.url}</div>
                  {bookmark.matchedSourceTags && bookmark.matchedSourceTags.length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Matched: {bookmark.matchedSourceTags.join(", ")}
                    </div>
                  )}
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Current tags</p>
                      <div className="flex flex-wrap gap-1">
                        {bookmark.currentTags.map((tag) => (
                          <span key={tag} className="rounded bg-muted px-2 py-0.5 text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Next tags</p>
                      <div className="flex flex-wrap gap-1">
                        {bookmark.nextTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No matching bookmarks found.</p>
          )}

          {previewResult.failed && previewResult.failed.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium">Failures</h3>
              <div className="space-y-2">
                {previewResult.failed.map((failure) => (
                  <div key={failure.url} className="rounded-md border border-red-200 p-3 text-sm">
                    <div className="font-medium break-all">{failure.title}</div>
                    <div className="text-xs text-muted-foreground break-all">{failure.url}</div>
                    <div className="mt-1 text-xs text-red-600">{failure.error}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
