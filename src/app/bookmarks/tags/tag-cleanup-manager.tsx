"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, RefreshCw, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagMappingGraph, type MappingGraphRow } from "./tag-mapping-graph";
import type {
  HatenaTagsListResponse,
  TagCleanupCandidatesResponse,
  TagMappingCandidate,
} from "@/types/habu";

export function TagCleanupManager() {
  const [tagCount, setTagCount] = useState(0);
  const [hatenaId, setHatenaId] = useState("");
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [isGeneratingCandidates, setIsGeneratingCandidates] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [missingWritePrivate, setMissingWritePrivate] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [candidates, setCandidates] = useState<TagMappingCandidate[]>([]);

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

      setTagCount(data.tags?.length ?? 0);
      setHatenaId(data.hatenaId ?? "");
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

      setCandidates(data.candidates ?? []);
      setMissingWritePrivate(data.missingWritePrivate ?? false);
      toast.success("Candidates generated");
    } catch (error) {
      toast.error("Candidate generation failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsGeneratingCandidates(false);
    }
  };

  const filteredCandidates = useMemo(() => {
    const normalizedFilter = filterText.trim().toLowerCase();
    if (!normalizedFilter) return candidates;

    return candidates.filter((candidate) => {
      return (
        candidate.sourceTag.toLowerCase().includes(normalizedFilter) ||
        candidate.targetTag?.toLowerCase().includes(normalizedFilter) ||
        candidate.reason?.toLowerCase().includes(normalizedFilter)
      );
    });
  }, [candidates, filterText]);

  const graphRows = useMemo<MappingGraphRow[]>(
    () =>
      filteredCandidates.map((candidate) => ({
        sourceTag: candidate.sourceTag,
        sourceCount: candidate.sourceCount ?? 0,
        action: candidate.action,
        targetTag: candidate.targetTag,
        targetCount: candidate.targetCount ?? 0,
      })),
    [filteredCandidates],
  );

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
              Generate candidate mappings and review the graph. This screen stops at candidate
              output and does not preview or apply updates.
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

        <div className="space-y-2">
          <Label htmlFor="tag-filter">Filter candidates</Label>
          <Input
            id="tag-filter"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            placeholder="Search before/after tags..."
          />
        </div>

        {inventoryError && <p className="mt-3 text-sm text-red-500">{inventoryError}</p>}

        {missingWritePrivate && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-300">
            Your current Hatena token does not include <code>write_private</code>. This does not
            block candidate generation, but would matter if updates are reintroduced later.
          </p>
        )}

        <div className="mt-4 rounded-lg border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              Tags: <strong>{tagCount}</strong>
            </span>
            <span>
              Suggested changes: <strong>{candidates.length}</strong>
            </span>
            <span>
              Visible candidates: <strong>{filteredCandidates.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {graphRows.length > 0 ? (
        <TagMappingGraph rows={graphRows} hatenaId={hatenaId} />
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No candidate edges yet. Generate candidates to visualize the mapping graph.
        </div>
      )}
    </div>
  );
}
