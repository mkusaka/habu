"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveBookmark } from "@/lib/queue-sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { OAuthButton } from "@/components/ui/oauth-button";

interface ShareFormProps {
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

export function ShareForm({
  initialUrl,
  initialTitle,
  initialComment,
  hasHatena,
}: ShareFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle);
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Validate URL on change
  const handleUrlChange = (value: string) => {
    setUrl(value);
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

    setSaving(true);
    try {
      const result = await saveBookmark(url, title, comment);

      if (result.success) {
        if (result.queued) {
          toast.success("Bookmark queued (will sync when online)");
        } else {
          toast.success("Bookmark saved!");
        }

        // Safe to close - SW handles retry if needed
        window.close();

        // If window.close() didn't work (popup blocker or same tab), redirect
        router.replace("/saved");
      } else {
        toast.error(result.error || "Failed to save bookmark");
      }
    } catch (error) {
      console.error("Failed to save bookmark:", error);
      toast.error("Failed to save bookmark");
    } finally {
      setSaving(false);
    }
  };

  // Auto-save on mount if enabled and has URL
  useEffect(() => {
    const autoSave = localStorage.getItem("habu-auto-save") === "true";
    if (autoSave && initialUrl && hasHatena) {
      // Auto-save the bookmark immediately on mount
      handleSave();
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Save Bookmark</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasHatena && (
          <div className="space-y-3 pb-4 border-b">
            <p className="text-sm text-muted-foreground">
              Connect your Hatena account to save bookmarks
            </p>
            <OAuthButton url="/api/habu/oauth/start?redirect=/share" className="w-full">
              <ExternalLink className="w-4 h-4 mr-2" />
              Connect Hatena
            </OAuthButton>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com"
            disabled={saving}
            className={urlError ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
          {urlError && (
            <p className="text-sm text-red-500">{urlError}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Title (optional)</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Page title"
            disabled={saving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comment">Comment (optional)</Label>
          <Input
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Your comment"
            disabled={saving}
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={!isUrlValid || saving || !hasHatena}
            className="flex-1"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
