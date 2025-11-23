"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveBookmarkOptimistic } from "@/lib/queue-sync";
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

  // Auto-save on mount if enabled and has URL
  useEffect(() => {
    const autoSave = localStorage.getItem("habu-auto-save") === "true";
    if (autoSave && initialUrl && hasHatena) {
      // Auto-save the bookmark
      handleSave();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!url) {
      toast.error("URL is required");
      return;
    }

    setSaving(true);
    try {
      await saveBookmarkOptimistic(url, title, comment);
      toast.success("Bookmark saved!");

      // Try to close the window (works when opened from share target)
      // If it fails, redirect to saved page
      setTimeout(() => {
        window.close();
        // If window.close() didn't work (same tab), redirect
        router.replace("/saved");
      }, 500);
    } catch (error) {
      console.error("Failed to save bookmark:", error);
      toast.error("Failed to save bookmark");
      setSaving(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
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
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            disabled={saving}
          />
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
            disabled={!url || saving || !hasHatena}
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
