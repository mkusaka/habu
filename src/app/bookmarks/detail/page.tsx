"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Bookmark,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Info,
  ArrowLeft,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

interface BookmarkData {
  url: string;
  comment: string;
  tags: string[];
  created_datetime: string;
}

interface GeneratedResult {
  summary?: string;
  tags?: string[];
  formattedComment?: string;
  markdown?: string;
  markdownError?: string;
  metadata?: {
    title?: string;
    description?: string;
    lang?: string;
    ogType?: string;
    siteName?: string;
    keywords?: string;
    author?: string;
  };
}

function BookmarkDetailContent() {
  const searchParams = useSearchParams();
  const bookmarkUrl = searchParams.get("url") || "";

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmark, setBookmark] = useState<BookmarkData | null>(null);

  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [showRawContent, setShowRawContent] = useState(false);

  // Fetch metadata for title
  const fetchMetadata = useCallback(async () => {
    if (!bookmarkUrl) return;

    setIsFetchingMetadata(true);
    try {
      const response = await fetch(
        `https://page-meta-proxy.polyfill.workers.dev/meta?url=${encodeURIComponent(bookmarkUrl)}`,
      );
      if (response.ok) {
        const meta = (await response.json()) as {
          title?: string;
          og?: { title?: string };
          twitter?: { title?: string };
        };
        const fetchedTitle = meta?.title || meta?.og?.title || meta?.twitter?.title;
        if (fetchedTitle) {
          setTitle(fetchedTitle);
        }
      }
    } catch {
      // Ignore metadata fetch errors
    } finally {
      setIsFetchingMetadata(false);
    }
  }, [bookmarkUrl]);

  // Fetch current bookmark data
  useEffect(() => {
    if (!bookmarkUrl) {
      setError("No URL specified");
      setIsLoading(false);
      return;
    }

    const fetchBookmark = async () => {
      try {
        const response = await fetch(`/api/habu/bookmark?url=${encodeURIComponent(bookmarkUrl)}`, {
          credentials: "include",
        });

        if (response.status === 404) {
          // Bookmark doesn't exist yet - that's okay for new bookmarks
          setBookmark(null);
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || "Failed to fetch bookmark");
        }

        const data = (await response.json()) as BookmarkData;
        setBookmark(data);
        setComment(data.comment || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookmark();
    fetchMetadata();
  }, [bookmarkUrl, fetchMetadata]);

  const handleGenerate = async () => {
    if (!bookmarkUrl) {
      toast.error("URL is required");
      return;
    }

    setIsGenerating(true);
    setGeneratedResult(null);

    try {
      const response = await fetch("/api/habu/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: bookmarkUrl }),
      });

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
        summary?: string;
        tags?: string[];
        formattedComment?: string;
        markdown?: string;
        markdownError?: string;
        metadata?: GeneratedResult["metadata"];
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate");
      }

      setGeneratedResult({
        summary: data.summary,
        tags: data.tags,
        formattedComment: data.formattedComment,
        markdown: data.markdown,
        markdownError: data.markdownError,
        metadata: data.metadata,
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

  const handleApplyGenerated = () => {
    if (generatedResult?.formattedComment) {
      setComment(generatedResult.formattedComment);
      toast.success("Applied generated comment");
    }
  };

  const handleUpdate = async () => {
    if (!bookmarkUrl) {
      toast.error("URL is required");
      return;
    }

    setIsUpdating(true);

    try {
      const response = await fetch("/api/habu/bookmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: bookmarkUrl, comment }),
      });

      const data = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update bookmark");
      }

      toast.success("Bookmark updated!");

      // Refresh bookmark data
      const refreshResponse = await fetch(
        `/api/habu/bookmark?url=${encodeURIComponent(bookmarkUrl)}`,
        {
          credentials: "include",
        },
      );
      if (refreshResponse.ok) {
        const refreshData = (await refreshResponse.json()) as BookmarkData;
        setBookmark(refreshData);
      }
    } catch (error) {
      toast.error("Update failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Parse tags from comment (e.g., "[tag1][tag2][tag3]summary text")
  const extractTags = (commentStr: string): string[] => {
    const tags: string[] = [];
    const tagRegex = /^\[([^\]]+)\]/;
    let remaining = commentStr;
    let match;
    while ((match = tagRegex.exec(remaining)) !== null) {
      tags.push(match[1]);
      remaining = remaining.slice(match[0].length);
    }
    return tags;
  };

  const extractCommentText = (commentStr: string): string => {
    return commentStr.replace(/^(\[[^\]]+\])+/, "").trim();
  };

  if (isLoading) {
    return (
      <main className="min-h-screen p-4 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-4 flex items-start justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center text-red-600">{error}</div>
            <LinkButton href="/bookmarks" variant="outline" className="w-full mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Bookmarks
            </LinkButton>
          </CardContent>
        </Card>
      </main>
    );
  }

  const currentTags = extractTags(comment);
  const currentCommentText = extractCommentText(comment);

  return (
    <main className="min-h-screen p-4 flex items-start justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <Bookmark className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-xl">Edit Bookmark</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL Display */}
          <div className="space-y-2">
            <Label>URL</Label>
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <span className="text-sm truncate flex-1">{bookmarkUrl}</span>
              <a
                href={bookmarkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <div className="relative">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isFetchingMetadata ? "Fetching..." : "Page title"}
                disabled={isFetchingMetadata}
              />
              {isFetchingMetadata && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* Current Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Comment</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Your comment"
              rows={3}
            />
            {currentTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {currentTags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {currentCommentText && (
              <p className="text-xs text-muted-foreground">{currentCommentText}</p>
            )}
          </div>

          {/* Bookmark Info */}
          {bookmark && (
            <div className="text-xs text-muted-foreground">
              Bookmarked: {new Date(bookmark.created_datetime).toLocaleString("ja-JP")}
            </div>
          )}

          {/* Generated Result */}
          {generatedResult && (
            <div className="p-3 bg-muted rounded-md space-y-3 text-sm">
              {/* AI Generated Summary */}
              <div>
                <div className="font-medium flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Generated Preview
                </div>
                {generatedResult.tags && generatedResult.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {generatedResult.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs"
                      >
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleApplyGenerated}
                      className="mt-2 w-full"
                    >
                      Apply to Comment
                    </Button>
                  </div>
                )}
              </div>

              {/* Raw Content Toggle */}
              {(generatedResult.markdown ||
                generatedResult.markdownError ||
                generatedResult.metadata) && (
                <div className="border-t pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRawContent(!showRawContent)}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground w-full"
                  >
                    {showRawContent ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    <span>Raw content (debug)</span>
                  </button>

                  {showRawContent && (
                    <div className="mt-2 space-y-3">
                      {/* Metadata */}
                      {generatedResult.metadata &&
                        Object.keys(generatedResult.metadata).length > 0 && (
                          <div>
                            <div className="flex items-center gap-1 text-xs font-medium mb-1">
                              <Info className="w-3 h-3" />
                              Metadata
                            </div>
                            <div className="bg-background p-2 rounded text-xs space-y-1">
                              {generatedResult.metadata.title && (
                                <div>
                                  <span className="text-muted-foreground">title:</span>{" "}
                                  {generatedResult.metadata.title}
                                </div>
                              )}
                              {generatedResult.metadata.description && (
                                <div>
                                  <span className="text-muted-foreground">description:</span>{" "}
                                  {generatedResult.metadata.description}
                                </div>
                              )}
                              {generatedResult.metadata.siteName && (
                                <div>
                                  <span className="text-muted-foreground">site:</span>{" "}
                                  {generatedResult.metadata.siteName}
                                </div>
                              )}
                              {generatedResult.metadata.lang && (
                                <div>
                                  <span className="text-muted-foreground">lang:</span>{" "}
                                  {generatedResult.metadata.lang}
                                </div>
                              )}
                              {generatedResult.metadata.ogType && (
                                <div>
                                  <span className="text-muted-foreground">type:</span>{" "}
                                  {generatedResult.metadata.ogType}
                                </div>
                              )}
                              {generatedResult.metadata.keywords && (
                                <div>
                                  <span className="text-muted-foreground">keywords:</span>{" "}
                                  {generatedResult.metadata.keywords}
                                </div>
                              )}
                              {generatedResult.metadata.author && (
                                <div>
                                  <span className="text-muted-foreground">author:</span>{" "}
                                  {generatedResult.metadata.author}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      {/* Markdown */}
                      {generatedResult.markdown ? (
                        <div>
                          <div className="flex items-center gap-1 text-xs font-medium mb-1">
                            <FileText className="w-3 h-3" />
                            Markdown ({generatedResult.markdown.length.toLocaleString()} chars)
                          </div>
                          <pre className="bg-background p-2 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap break-all">
                            {generatedResult.markdown.slice(0, 5000)}
                            {generatedResult.markdown.length > 5000 && "\n\n... (truncated)"}
                          </pre>
                        </div>
                      ) : generatedResult.markdownError ? (
                        <div>
                          <div className="flex items-center gap-1 text-xs font-medium mb-1 text-yellow-600">
                            <AlertCircle className="w-3 h-3" />
                            Markdown fetch error
                          </div>
                          <pre className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded text-xs text-yellow-800 dark:text-yellow-200 overflow-auto max-h-24 whitespace-pre-wrap break-all">
                            {generatedResult.markdownError}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
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

            <Button onClick={handleUpdate} disabled={isUpdating} className="flex-1" size="lg">
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </div>

          {/* Navigation */}
          <div className="pt-2">
            <LinkButton href="/bookmarks" variant="outline" className="w-full" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Bookmarks
            </LinkButton>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function BookmarkDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-4 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </main>
      }
    >
      <BookmarkDetailContent />
    </Suspense>
  );
}
