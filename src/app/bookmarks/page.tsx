import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSignedRequest } from "@/lib/hatena-oauth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bookmark,
  Home,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Settings,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkButton } from "@/components/ui/link-button";
import { RefreshButton } from "./refresh-button";
import { RegenerateButton } from "./regenerate-button";

async function getHatenaStatus(): Promise<boolean> {
  const cookieStore = await cookies();
  const { env } = getCloudflareContext();
  const auth = createAuth(env.DB);

  const session = await auth.api.getSession({
    headers: {
      cookie: cookieStore.toString(),
    },
  });

  if (!session?.user) {
    return false;
  }

  const db = getDb(env.DB);
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  return !!user?.hatenaId;
}

const PAGE_SIZE = 20;
const HATENA_MY_API_URL = "https://bookmark.hatenaapis.com/rest/1/my";

interface HatenaMyResponse {
  name: string;
}

interface HatenaBookmarkEntry {
  title: string;
  canonical_url: string;
}

interface HatenaBookmarkItem {
  url: string;
  comment: string;
  tags: string[];
  created: string;
  entry: HatenaBookmarkEntry;
}

interface HatenaBookmarksApiResponse {
  item: {
    bookmarks: HatenaBookmarkItem[];
  };
}

interface BookmarkItem {
  url: string;
  title: string;
  comment: string;
  tags: string[];
  bookmarkedAt: string;
}

interface FetchBookmarksResult {
  success: boolean;
  error?: string;
  bookmarks?: BookmarkItem[];
  username?: string;
}

async function fetchBookmarks(page: number): Promise<FetchBookmarksResult> {
  const cookieStore = await cookies();
  const { env } = getCloudflareContext();
  const auth = createAuth(env.DB);

  const session = await auth.api.getSession({
    headers: {
      cookie: cookieStore.toString(),
    },
  });

  if (!session?.user) {
    return { success: false, error: "Not authenticated" };
  }

  const db = getDb(env.DB);
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    with: { hatenaToken: true },
  });

  if (!user?.hatenaToken) {
    return { success: false, error: "Hatena not connected" };
  }

  const { accessToken: hatenaAccessToken, accessTokenSecret: hatenaAccessTokenSecret } =
    user.hatenaToken;

  const consumerKey = env.HATENA_CONSUMER_KEY;
  const consumerSecret = env.HATENA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    return { success: false, error: "Server configuration error" };
  }

  // Get username
  const authHeaders = createSignedRequest(
    HATENA_MY_API_URL,
    "GET",
    hatenaAccessToken,
    hatenaAccessTokenSecret,
    consumerKey,
    consumerSecret,
  );

  const myResponse = await fetch(HATENA_MY_API_URL, {
    method: "GET",
    headers: authHeaders,
  });

  if (!myResponse.ok) {
    const errorText = await myResponse.text();
    return {
      success: false,
      error: `Failed to get user info: ${myResponse.status} - ${errorText}`,
    };
  }

  const myData = (await myResponse.json()) as HatenaMyResponse;
  const username = myData.name;

  // Fetch bookmarks using unofficial API (uses page parameter)
  const bookmarksApiUrl = `https://b.hatena.ne.jp/api/users/${username}/bookmarks?page=${page}`;

  const bookmarksResponse = await fetch(bookmarksApiUrl, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!bookmarksResponse.ok) {
    return { success: false, error: `Failed to fetch bookmarks: ${bookmarksResponse.status}` };
  }

  const bookmarksData = (await bookmarksResponse.json()) as HatenaBookmarksApiResponse;

  const bookmarks: BookmarkItem[] = bookmarksData.item.bookmarks.map((item) => ({
    url: item.entry.canonical_url || item.url,
    title: item.entry.title,
    comment: item.comment,
    tags: item.tags,
    bookmarkedAt: item.created,
  }));

  return { success: true, bookmarks, username };
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function extractComment(comment: string) {
  return comment.replace(/^(\[[^\]]+\])+/, "").trim();
}

function BookmarkListLoading() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="w-full p-3 rounded-md border">
          {/* Header skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 flex-1" />
            <div className="flex items-center gap-1 flex-shrink-0">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-6 w-6 rounded" />
            </div>
          </div>
          {/* Body skeleton */}
          <div className="mt-1 space-y-1">
            <div className="flex gap-1">
              <Skeleton className="h-5 w-12 rounded" />
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-5 w-10 rounded" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function BookmarkList({ page }: { page: number }) {
  console.log("[BookmarkList] Fetching", { page });
  const result = await fetchBookmarks(page);
  console.log("[BookmarkList] Result", {
    success: result.success,
    count: result.bookmarks?.length,
    firstTitle: result.bookmarks?.[0]?.title?.slice(0, 30),
  });

  if (!result.success) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-md text-sm text-red-800 dark:text-red-200">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>{result.error}</span>
      </div>
    );
  }

  const bookmarks = result.bookmarks || [];
  const hasMore = bookmarks.length === PAGE_SIZE;

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No bookmarks found</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {bookmarks.map((bookmark, index) => (
          <div
            key={`${bookmark.url}-${index}`}
            className="relative w-full text-left p-3 rounded-md border hover:bg-muted/50 transition-colors"
          >
            <Link
              href={`/bookmarks/detail?url=${encodeURIComponent(bookmark.url)}`}
              className="absolute inset-0"
              aria-label={`Edit bookmark: ${bookmark.title || bookmark.url}`}
            />
            {/* Header: Title + Action buttons */}
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm truncate flex-1 min-w-0">
                {bookmark.title || bookmark.url}
              </h3>
              <div className="flex items-center gap-1 flex-shrink-0">
                <RegenerateButton url={bookmark.url} title={bookmark.title} />
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative z-10 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
            {/* Body: Tags, Comment, Date */}
            <div className="mt-1">
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
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="relative z-10 flex items-center justify-between pt-2">
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

interface BookmarksPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function BookmarksPage({ searchParams }: BookmarksPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const hasHatena = await getHatenaStatus();

  console.log("[BookmarksPage] Rendering", { params, page });

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bookmark className="w-6 h-6 text-primary" />
            <CardTitle className="text-xl">My Bookmarks</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <RefreshButton />
            <LinkButton href="/" variant="ghost" size="icon">
              <Home className="w-5 h-5" />
            </LinkButton>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connect to Hatena (only when not connected) */}
        {!hasHatena && (
          <LinkButton href="/settings" variant="outline" size="sm" className="w-full">
            <Settings className="w-4 h-4 mr-2" />
            Connect to Hatena Bookmark
          </LinkButton>
        )}
        <Suspense key={page} fallback={<BookmarkListLoading />}>
          <BookmarkList page={page} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
