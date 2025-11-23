"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveBookmarkOptimistic } from "@/lib/queue-sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SharePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Get shared data from URL params (from Web Share Target)
    const sharedUrl = searchParams.get("url") || "";
    const sharedTitle = searchParams.get("title") || "";
    const sharedText = searchParams.get("text") || "";

    setUrl(sharedUrl);
    setTitle(sharedTitle);
    setComment(sharedText);

    // If we have a URL, auto-save it
    if (sharedUrl) {
      handleSave(sharedUrl, sharedTitle, sharedText);
    }
  }, [searchParams]);

  const handleSave = async (
    saveUrl?: string,
    saveTitle?: string,
    saveComment?: string
  ) => {
    const urlToSave = saveUrl || url;
    if (!urlToSave) {
      toast.error("URL is required");
      return;
    }

    setSaving(true);
    try {
      await saveBookmarkOptimistic(urlToSave, saveTitle || title, saveComment || comment);
      toast.success("Bookmark saved!");
      router.replace("/saved");
    } catch (error) {
      console.error("Failed to save bookmark:", error);
      toast.error("Failed to save bookmark");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Save Bookmark</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              onClick={() => handleSave()}
              disabled={!url || saving}
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
    </div>
  );
}
