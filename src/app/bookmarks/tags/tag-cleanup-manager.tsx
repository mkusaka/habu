"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowRightLeft, Tags, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { HatenaTag, HatenaTagsListResponse, TagCleanupResponse } from "@/types/habu";

export function TagCleanupManager() {
  const [sourceTag, setSourceTag] = useState("");
  const [targetTag, setTargetTag] = useState("");
  const [tagInventory, setTagInventory] = useState<HatenaTag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [missingWritePrivate, setMissingWritePrivate] = useState(false);
  const [previewResult, setPreviewResult] = useState<TagCleanupResponse | null>(null);

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

      setTagInventory(data.tags ?? []);
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

  const isFormValid =
    sourceTag.trim().length > 0 &&
    targetTag.trim().length > 0 &&
    sourceTag.trim().toLowerCase() !== targetTag.trim().toLowerCase();

  const tagNames = useMemo(() => tagInventory.map((tag) => tag.tag), [tagInventory]);

  const handlePreview = async () => {
    if (!isFormValid) {
      toast.error("Select different source and target tags");
      return;
    }

    setIsPreviewing(true);

    try {
      const response = await fetch("/api/habu/tag-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "preview",
          sourceTag: sourceTag.trim(),
          targetTag: targetTag.trim(),
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
    if (!isFormValid) return;

    setIsApplying(true);

    try {
      const response = await fetch("/api/habu/tag-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "apply",
          sourceTag: sourceTag.trim(),
          targetTag: targetTag.trim(),
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
              <Tags className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-medium">Tag Mapping</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Preview and apply a global tag rename by updating every matching bookmark.
            </p>
          </div>
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

        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-2">
            <Label htmlFor="source-tag">Source tag</Label>
            <Input
              id="source-tag"
              list="hatena-tag-options"
              value={sourceTag}
              onChange={(event) => setSourceTag(event.target.value)}
              placeholder="e.g. React"
            />
          </div>

          <div className="flex items-end justify-center pb-2">
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-tag">Target tag</Label>
            <Input
              id="target-tag"
              list="hatena-tag-options"
              value={targetTag}
              onChange={(event) => setTargetTag(event.target.value)}
              placeholder="e.g. frontend"
            />
          </div>
        </div>

        <datalist id="hatena-tag-options">
          {tagNames.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>

        {inventoryError && <p className="mt-3 text-sm text-red-500">{inventoryError}</p>}

        {missingWritePrivate && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-300">
            Your current Hatena token does not include <code>write_private</code>. Public bookmarks
            can still be updated, but private bookmark updates may fail until you reconnect Hatena.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={!isFormValid || isPreviewing}
          >
            {isPreviewing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Previewing...
              </>
            ) : (
              "Preview affected bookmarks"
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" disabled={!isFormValid || isApplying}>
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  "Apply global update"
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apply tag cleanup</AlertDialogTitle>
                <AlertDialogDescription>
                  This will update every bookmark that currently has{" "}
                  <code>{sourceTag || "(source)"}</code> and replace it with{" "}
                  <code>{targetTag || "(target)"}</code>.
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

      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Tag inventory</h2>
            <p className="text-sm text-muted-foreground">
              {isLoadingTags ? "Loading tags..." : `${tagInventory.length} tags available`}
            </p>
          </div>
        </div>

        {tagInventory.length > 0 && (
          <div className="flex max-h-52 flex-wrap gap-1 overflow-y-auto rounded-md bg-muted/60 p-2">
            {tagInventory.map((tag) => (
              <button
                key={tag.tag}
                type="button"
                onClick={() => setSourceTag(tag.tag)}
                className="rounded bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {tag.tag} ({tag.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {previewResult && (
        <div className="rounded-lg border p-4">
          <div className="mb-3 space-y-1">
            <h2 className="font-medium">Preview</h2>
            <p className="text-sm text-muted-foreground">
              {previewResult.totalMatched ?? 0} bookmarks will change from{" "}
              <code>{previewResult.sourceTag}</code> to <code>{previewResult.targetTag}</code>.
              {(previewResult.preview?.length ?? 0) < (previewResult.totalMatched ?? 0) &&
                ` Showing first ${previewResult.preview?.length ?? 0}.`}
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
