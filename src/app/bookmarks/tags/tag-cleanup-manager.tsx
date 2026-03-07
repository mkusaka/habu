"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagMappingGraph, type MappingGraphRow } from "./tag-mapping-graph";
import type { TagCleanupCandidatesResponse, TagMappingCandidate } from "@/types/habu";

export function TagCleanupManager() {
  const [tagCount, setTagCount] = useState(0);
  const [hatenaId, setHatenaId] = useState("");
  const [isGeneratingCandidates, setIsGeneratingCandidates] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [candidates, setCandidates] = useState<TagMappingCandidate[]>([]);

  const handleGenerateCandidates = async () => {
    setIsGeneratingCandidates(true);
    setErrorMessage(null);

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
      setTagCount(data.tagCount ?? 0);
      setHatenaId(data.hatenaId ?? "");
      toast.success("Candidates generated");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
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
          <div className="flex items-center gap-2">
            <WandSparkles className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-medium">Mapping Candidates</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateCandidates}
            disabled={isGeneratingCandidates}
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

        {errorMessage && <p className="mt-3 text-sm text-red-500">{errorMessage}</p>}

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
