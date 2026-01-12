import { Suspense } from "react";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSignedRequest } from "@/lib/hatena-oauth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bookmark, ExternalLink, ArrowLeft, AlertCircle, Home } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookmarkEditForm } from "./bookmark-edit-form";
import { fetchPageMeta, isMetaExtractionResult } from "@/lib/page-meta";

export const dynamic = "force-dynamic";

const HATENA_BOOKMARK_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/bookmark";

interface HatenaBookmarkGetResponse {
  url: string;
  comment: string;
  tags: string[];
  created_datetime: string;
}

interface PageMetadata {
  title?: string;
  description?: string;
  siteName?: string;
  lang?: string;
}

interface FetchResult {
  success: boolean;
  error?: string;
  bookmark?: HatenaBookmarkGetResponse;
  title?: string;
  metadata?: PageMetadata;
}

async function fetchBookmarkData(bookmarkUrl: string): Promise<FetchResult> {
  if (!bookmarkUrl) {
    return { success: false, error: "No URL specified" };
  }

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

  // Fetch bookmark and metadata in parallel
  const apiUrl = `${HATENA_BOOKMARK_API_URL}?url=${encodeURIComponent(bookmarkUrl)}`;
  const authHeaders = createSignedRequest(
    apiUrl,
    "GET",
    hatenaAccessToken,
    hatenaAccessTokenSecret,
    consumerKey,
    consumerSecret,
  );

  const [bookmarkResponse, metaResult] = await Promise.all([
    fetch(apiUrl, { method: "GET", headers: authHeaders }),
    fetchPageMeta(bookmarkUrl).catch(() => null),
  ]);

  // Parse title and metadata
  let title: string | undefined;
  let metadata: PageMetadata | undefined;
  if (metaResult && isMetaExtractionResult(metaResult)) {
    title = metaResult.title || metaResult.og?.title || metaResult.twitter?.title;
    metadata = {
      title,
      description: metaResult.description || metaResult.og?.description,
      siteName: metaResult.og?.siteName,
      lang: metaResult.lang,
    };
  }

  // Handle bookmark response
  if (bookmarkResponse.status === 404) {
    // Bookmark doesn't exist yet - that's okay for new bookmarks
    return { success: true, bookmark: undefined, title, metadata };
  }

  if (!bookmarkResponse.ok) {
    const errorText = await bookmarkResponse.text();
    return { success: false, error: `Hatena API error: ${bookmarkResponse.status} - ${errorText}` };
  }

  const bookmark = (await bookmarkResponse.json()) as HatenaBookmarkGetResponse;
  return { success: true, bookmark, title, metadata };
}

function BookmarkDetailLoading() {
  return (
    <div className="space-y-4">
      {/* URL Display skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-8" /> {/* "URL" label: text-sm leading-none */}
        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
          <Skeleton className="h-5 flex-1" /> {/* URL text: text-sm */}
          <Skeleton className="h-4 w-4" /> {/* Copy icon */}
          <Skeleton className="h-4 w-4" /> {/* ExternalLink icon */}
          <Skeleton className="h-4 w-4" /> {/* Bookmark icon */}
        </div>
      </div>
      {/* Title Display skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-8" /> {/* "Title" label: text-sm leading-none */}
        <div className="p-2 bg-muted rounded-md">
          <Skeleton className="h-5 w-3/4" /> {/* Title text: text-sm */}
        </div>
      </div>
      {/* Comment textarea skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-16" /> {/* "Comment" label */}
        <Skeleton className="h-[74px] w-full" /> {/* Textarea (rows=3) */}
        {/* Tag preview */}
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-5 w-12" /> {/* tag chip */}
          <Skeleton className="h-5 w-16" /> {/* tag chip */}
          <Skeleton className="h-5 w-10" /> {/* tag chip */}
        </div>
        {/* Comment text preview */}
        <Skeleton className="h-4 w-3/4" /> {/* text-xs */}
      </div>
      {/* Context toggle skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" /> {/* Chevron icon */}
        <Skeleton className="h-3.5 w-44" /> {/* "Add context...": text-sm */}
      </div>
      {/* Bookmarked at skeleton */}
      <Skeleton className="h-4 w-48" /> {/* Bookmarked date: text-xs */}
      {/* Action buttons skeleton - Generate / Update */}
      <div className="flex gap-2">
        <Skeleton className="h-11 flex-1" /> {/* Generate button */}
        <Skeleton className="h-11 flex-1" /> {/* Update button */}
      </div>
      {/* Chat button skeleton */}
      <Skeleton className="h-11 w-full" />
      {/* Delete button skeleton */}
      <Skeleton className="h-11 w-full" />
      {/* Back to Bookmarks button skeleton */}
      <div className="pt-2">
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

async function BookmarkDetailContent({ bookmarkUrl }: { bookmarkUrl: string }) {
  const result = await fetchBookmarkData(bookmarkUrl);

  if (!result.success) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-md text-sm text-red-800 dark:text-red-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{result.error}</span>
        </div>
        <LinkButton href="/bookmarks" variant="outline" className="w-full">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Bookmarks
        </LinkButton>
      </div>
    );
  }

  // Format initial comment with tags
  const initialComment = result.bookmark
    ? (result.bookmark.tags?.length ? result.bookmark.tags.map((t) => `[${t}]`).join("") : "") +
      (result.bookmark.comment || "")
    : "";

  return (
    <div className="space-y-4">
      {/* URL Display (static) */}
      <div className="space-y-2">
        <Label>URL</Label>
        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
          <span className="text-sm truncate flex-1">{bookmarkUrl}</span>
          <CopyButton text={bookmarkUrl} label="URL" />
          <a
            href={bookmarkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            title="Open page"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href={`https://b.hatena.ne.jp/entry/${bookmarkUrl.startsWith("https://") ? "s/" + bookmarkUrl.slice(8) : bookmarkUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            title="View on Hatena Bookmark"
          >
            <Bookmark className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Title Display (static) */}
      <div className="space-y-2">
        <Label>Title</Label>
        <div className="p-2 bg-muted rounded-md text-sm">
          {result.title || <span className="text-muted-foreground">No title</span>}
        </div>
      </div>

      {/* Interactive Form (client component) */}
      <BookmarkEditForm
        bookmarkUrl={bookmarkUrl}
        initialComment={initialComment}
        bookmarkedAt={result.bookmark?.created_datetime}
        pageMetadata={result.metadata}
      />

      {/* Navigation */}
      <div className="pt-2">
        <LinkButton href="/bookmarks" variant="outline" className="w-full" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Bookmarks
        </LinkButton>
      </div>
    </div>
  );
}

interface BookmarkDetailPageProps {
  searchParams: Promise<{ url?: string }>;
}

export default async function BookmarkDetailPage({ searchParams }: BookmarkDetailPageProps) {
  const params = await searchParams;
  const bookmarkUrl = params.url || "";

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bookmark className="w-6 h-6 text-primary" />
            <CardTitle className="text-xl">Edit Bookmark</CardTitle>
          </div>
          <LinkButton href="/" variant="ghost" size="icon" aria-label="Go Home">
            <Home className="w-5 h-5" />
          </LinkButton>
        </div>
      </CardHeader>
      <CardContent>
        <Suspense key={bookmarkUrl} fallback={<BookmarkDetailLoading />}>
          <BookmarkDetailContent bookmarkUrl={bookmarkUrl} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
