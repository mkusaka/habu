"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { queueBookmark } from "@/lib/queue-sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bookmark, List, Settings, Loader2, WifiOff, AlertCircle } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

interface SaveFormProps {
  initialUrl: string;
  initialTitle: string;
  initialComment: string;
  hasHatena: boolean;
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

  const debouncedUrl = useDebounce(url, 500);

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

    // Clear form
    setUrl("");
    setTitle("");
    setComment("");
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

        <Button
          onClick={handleSave}
          disabled={!isUrlValid || isSaving}
          className="w-full"
          size="lg"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Bookmark"
          )}
        </Button>

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
