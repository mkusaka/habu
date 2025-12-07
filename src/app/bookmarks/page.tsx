"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bookmark, Loader2, ChevronLeft, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import type { BookmarkItem, BookmarksResponse } from "@/app/api/habu/bookmarks/route";

const PAGE_SIZE = 20;

export default function BookmarksPage() {
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [username, setUsername] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchBookmarks = async (newOffset: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/habu/bookmarks?limit=${PAGE_SIZE}&offset=${newOffset}`, {
        credentials: "include",
      });

      const data = (await response.json()) as BookmarksResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch bookmarks");
      }

      setBookmarks(data.bookmarks || []);
      setUsername(data.username || "");
      setHasMore((data.bookmarks || []).length === PAGE_SIZE);
      setOffset(newOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookmarks(0);
  }, []);

  const handlePrevPage = () => {
    if (offset >= PAGE_SIZE) {
      fetchBookmarks(offset - PAGE_SIZE);
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      fetchBookmarks(offset + PAGE_SIZE);
    }
  };

  const handleRefresh = () => {
    fetchBookmarks(offset);
  };

  const handleBookmarkClick = (url: string) => {
    router.push(`/bookmarks/detail?url=${encodeURIComponent(url)}`);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Extract comment text without tags
  const extractComment = (comment: string) => {
    // Remove [tag] patterns at the beginning
    return comment.replace(/^(\[[^\]]+\])+/, "").trim();
  };

  return (
    <main className="min-h-screen p-4 flex items-start justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bookmark className="w-6 h-6 text-primary" />
              <div>
                <CardTitle className="text-xl">My Bookmarks</CardTitle>
                {username && (
                  <p className="text-xs text-muted-foreground">@{username}</p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error State */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-md text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && bookmarks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No bookmarks found</p>
            </div>
          )}

          {/* Bookmark List */}
          {!isLoading && bookmarks.length > 0 && (
            <div className="space-y-2">
              {bookmarks.map((bookmark, index) => (
                <button
                  key={`${bookmark.url}-${index}`}
                  onClick={() => handleBookmarkClick(bookmark.url)}
                  className="w-full text-left p-3 rounded-md border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">
                        {bookmark.title || bookmark.url}
                      </h3>
                      {bookmark.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {bookmark.tags.map((tag, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {extractComment(bookmark.comment) && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {extractComment(bookmark.comment)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(bookmark.bookmarkedAt)}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && bookmarks.length > 0 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={offset === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">
                {offset + 1} - {offset + bookmarks.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasMore}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Navigation */}
          <div className="pt-4 border-t">
            <LinkButton href="/" variant="outline" className="w-full" size="sm">
              <Bookmark className="w-4 h-4 mr-2" />
              New Bookmark
            </LinkButton>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
