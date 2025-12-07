import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import type { BookmarkItem } from "./page";

interface BookmarkListProps {
  bookmarks: BookmarkItem[];
  page: number;
  hasMore: boolean;
}

export function BookmarkList({ bookmarks, page, hasMore }: BookmarkListProps) {
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
    return comment.replace(/^(\[[^\]]+\])+/, "").trim();
  };

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No bookmarks found</p>
      </div>
    );
  }

  return (
    <>
      {/* Bookmark List */}
      <div className="space-y-2">
        {bookmarks.map((bookmark, index) => (
          <Link
            key={`${bookmark.url}-${index}`}
            href={`/bookmarks/detail?url=${encodeURIComponent(bookmark.url)}`}
            className="block w-full text-left p-3 rounded-md border hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{bookmark.title || bookmark.url}</h3>
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
          </Link>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-2">
        {page > 1 ? (
          <LinkButton href={`/bookmarks?page=${page - 1}`} variant="outline" size="sm">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Prev
          </LinkButton>
        ) : (
          <span className="inline-flex items-center px-3 py-1.5 text-sm text-muted-foreground">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Prev
          </span>
        )}
        <span className="text-sm text-muted-foreground">Page {page}</span>
        {hasMore ? (
          <LinkButton href={`/bookmarks?page=${page + 1}`} variant="outline" size="sm">
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </LinkButton>
        ) : (
          <span className="inline-flex items-center px-3 py-1.5 text-sm text-muted-foreground">
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </span>
        )}
      </div>
    </>
  );
}
