"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { queueBookmark } from "@/lib/queue-sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bookmark, List, Settings, Loader2, WifiOff, AlertCircle, Sparkles } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

interface SaveFormProps {
  initialUrl: string;
  initialTitle: string;
  initialComment: string;
  hasHatena: boolean;
}

interface DraftData {
  url: string;
  title: string;
  comment: string;
  timestamp: number;
}

const DRAFT_KEY = "habu-draft";
const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Save draft to localStorage
function saveDraft(url: string, title: string, comment: string) {
  if (!url && !title && !comment) {
    localStorage.removeItem(DRAFT_KEY);
    return;
  }
  const draft: DraftData = { url, title, comment, timestamp: Date.now() };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

// Load draft from localStorage
function loadDraft(): DraftData | null {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) return null;
    const draft = JSON.parse(stored) as DraftData;
    // Check if draft is expired
    if (Date.now() - draft.timestamp > DRAFT_EXPIRY_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

// Clear draft from localStorage
function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

// Validate URL format
function isValidUrl(urlString: string): boolean {
  if (!urlString) return false;
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function SaveForm({ initialUrl, initialTitle, initialComment, hasHatena }: SaveFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle);
  const [comment, setComment] = useState(initialComment);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<{
    summary?: string;
    tags?: string[];
    formattedComment?: string;
  } | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const debouncedUrl = useDebounce(url, 500);

  // Restore draft on mount (only if no initial values from URL params)
  useEffect(() => {
    if (!initialUrl && !initialTitle && !initialComment) {
      const draft = loadDraft();
      if (draft && (draft.url || draft.title || draft.comment)) {
        setUrl(draft.url);
        setTitle(draft.title);
        setComment(draft.comment);
        setDraftRestored(true);
      }
    }
  }, [initialUrl, initialTitle, initialComment]);

  // Save draft when fields change (debounced)
  const debouncedTitle = useDebounce(title, 500);
  const debouncedComment = useDebounce(comment, 500);

  useEffect(() => {
    // Don't save draft if we just restored it
    if (draftRestored) {
      setDraftRestored(false);
      return;
    }
    saveDraft(debouncedUrl, debouncedTitle, debouncedComment);
  }, [debouncedUrl, debouncedTitle, debouncedComment, draftRestored]);

  // Track online status
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      if (!hasHatena) {
        toast.info("You're back online!", {
          description: "Connect to Hatena Bookmark in Settings to sync your bookmarks.",
          action: {
            label: "Settings",
            onClick: () => router.push("/settings"),
          },
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("You're offline", {
        description: "Bookmarks will be saved locally and synced when online.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [hasHatena, router]);

  // Fetch title when URL changes (debounced)
  const fetchTitle = useCallback(async (targetUrl: string) => {
    if (!isValidUrl(targetUrl) || !isOnline) return;

    setIsFetchingTitle(true);
    try {
      const response = await fetch(`/api/habu/meta?url=${encodeURIComponent(targetUrl)}`);
      if (response.ok) {
        const data = (await response.json()) as { title?: string };
        if (data.title && !title) {
          setTitle(data.title);
        }
      }
    } catch {
      // Ignore fetch errors - title is optional
    } finally {
      setIsFetchingTitle(false);
    }
  }, [isOnline, title]);

  useEffect(() => {
    if (debouncedUrl && isValidUrl(debouncedUrl) && !initialTitle) {
      fetchTitle(debouncedUrl);
    }
  }, [debouncedUrl, fetchTitle, initialTitle]);

  // Validate URL on change
  const handleUrlChange = (value: string) => {
    setUrl(value);
    // Clear title when URL changes (will be re-fetched)
    if (value !== url) {
      setTitle("");
    }
    if (!value) {
      setUrlError(null);
    } else if (!isValidUrl(value)) {
      setUrlError("Please enter a valid URL (e.g., https://example.com)");
    } else {
      setUrlError(null);
    }
  };

  const isUrlValid = url && isValidUrl(url);

  const handleGenerate = async () => {
    if (!url) {
      toast.error("URL is required");
      return;
    }

    if (!isValidUrl(url)) {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsGenerating(true);
    setGeneratedResult(null);

    try {
      const response = await fetch("/api/habu/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate");
      }

      setGeneratedResult({
        summary: data.summary,
        tags: data.tags,
        formattedComment: data.formattedComment,
      });

      toast.success("Generated!", {
        description: "AI-generated summary and tags are ready.",
      });
    } catch (error) {
      toast.error("Generation failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!url) {
      toast.error("URL is required");
      return;
    }

    if (!isValidUrl(url)) {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsSaving(true);

    // Fire-and-forget: queue the bookmark
    queueBookmark(url, title, comment);

    toast.success("Bookmark saved!", {
      description: hasHatena && isOnline
        ? "Syncing with Hatena Bookmark..."
        : "Will sync when connected to Hatena.",
    });

    // Clear form and draft
    setUrl("");
    setTitle("");
    setComment("");
    clearDraft();
    setIsSaving(false);

    // Try to close window (works when opened as share target)
    window.close();

    // If window.close() didn't work, redirect to saved page
    router.replace("/saved");
  };

  // Auto-save on mount if enabled and has URL
  useEffect(() => {
    const autoSave = localStorage.getItem("habu-auto-save") === "true";
    if (autoSave && initialUrl && isValidUrl(initialUrl)) {
      // Fire-and-forget: queue the bookmark
      queueBookmark(initialUrl, initialTitle, initialComment);

      // Clear draft since we're auto-saving
      clearDraft();

      // Close the window immediately - SW handles the rest
      window.close();

      // If window.close() didn't work, redirect to saved page
      router.replace("/saved");
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="w-full">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-3">
          <Bookmark className="w-12 h-12 text-primary" />
        </div>
        <CardTitle className="text-xl">habu</CardTitle>
        <p className="text-xs text-muted-foreground">Quick bookmark saving</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status messages */}
        {!isOnline && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md text-sm">
            <WifiOff className="w-4 h-4 text-yellow-600" />
            <span className="text-yellow-800 dark:text-yellow-200">
              Offline - bookmarks will sync when online
            </span>
          </div>
        )}

        {isOnline && !hasHatena && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-sm">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <span className="text-blue-800 dark:text-blue-200">
              <button
                onClick={() => router.push("/settings")}
                className="underline hover:no-underline"
              >
                Connect to Hatena
              </button>
              {" "}to sync bookmarks
            </span>
          </div>
        )}

        {/* Form */}
        <div className="space-y-2">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com"
            className={urlError ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
          {urlError && <p className="text-sm text-red-500">{urlError}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="title" className="flex items-center gap-2">
            Title
            {isFetchingTitle && <Loader2 className="w-3 h-3 animate-spin" />}
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isFetchingTitle ? "Fetching..." : "Page title (auto-filled)"}
            disabled={isFetchingTitle}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="comment">Comment (optional)</Label>
          <Input
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Your comment"
          />
        </div>

        {/* Generated Result */}
        {generatedResult && (
          <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
            <div className="font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Generated Preview
            </div>
            {generatedResult.tags && generatedResult.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {generatedResult.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {generatedResult.summary && (
              <p className="text-muted-foreground">{generatedResult.summary}</p>
            )}
            {generatedResult.formattedComment && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Formatted comment:</p>
                <code className="text-xs bg-background p-2 rounded block break-all">
                  {generatedResult.formattedComment}
                </code>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={!isUrlValid || isGenerating || !hasHatena || !isOnline}
            variant="outline"
            className="flex-1"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate
              </>
            )}
          </Button>

          <Button
            onClick={handleSave}
            disabled={!isUrlValid || isSaving}
            className="flex-1"
            size="lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex gap-2 pt-2">
          <LinkButton href="/queue" variant="outline" className="flex-1" size="sm">
            <List className="w-4 h-4 mr-2" />
            Queue
          </LinkButton>
          <LinkButton href="/settings" variant="outline" className="flex-1" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </LinkButton>
        </div>
      </CardContent>
    </Card>
  );
}
