"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TagMappingGraph, type MappingGraphRow } from "./tag-mapping-graph";
import type { TagCleanupCandidatesResponse, TagMappingCandidate } from "@/types/habu";

export function TagCleanupManager() {
  const [tagCount, setTagCount] = useState(0);
  const [hatenaId, setHatenaId] = useState("");
  const [isGeneratingCandidates, setIsGeneratingCandidates] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
        throw new Error(data.error || "Failed to generate suggestions");
      }

      setCandidates(data.candidates ?? []);
      setTagCount(data.tagCount ?? 0);
      setHatenaId(data.hatenaId ?? "");
      toast.success("Suggestions generated");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      toast.error("Suggestion generation failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsGeneratingCandidates(false);
    }
  };

  const graphRows = useMemo<MappingGraphRow[]>(
    () =>
      candidates.map((candidate) => ({
        sourceTag: candidate.sourceTag,
        sourceCount: candidate.sourceCount ?? 0,
        action: candidate.action,
        targetTag: candidate.targetTag,
        targetCount: candidate.targetCount ?? 0,
      })),
    [candidates],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <WandSparkles className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-medium">Cleanup Suggestions</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateCandidates}
            disabled={isGeneratingCandidates}
            className="w-full sm:w-auto"
          >
            {isGeneratingCandidates ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate suggestions
              </>
            )}
          </Button>
        </div>

        {errorMessage && (
          <Alert variant="destructive" className="mt-3">
            <AlertTitle>Suggestion generation failed</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="mt-4 rounded-lg border bg-muted/20 p-3">
          <div className="grid gap-2 text-sm sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <span className="min-w-0">
              Tags: <strong>{tagCount}</strong>
            </span>
            <span className="min-w-0">
              Suggestions: <strong>{candidates.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {graphRows.length > 0 ? (
        <TagMappingGraph rows={graphRows} hatenaId={hatenaId} />
      ) : (
        <Empty className="border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WandSparkles />
            </EmptyMedia>
            <EmptyTitle>No suggestions yet</EmptyTitle>
            <EmptyDescription>
              Generate suggestions to visualize likely tag merges and cleanup targets.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
