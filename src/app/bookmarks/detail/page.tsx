import { Suspense } from "react";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSignedRequest } from "@/lib/hatena-oauth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bookmark, ExternalLink, ArrowLeft, AlertCircle } from "lucide-react";
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

interface FetchResult {
  success: boolean;
  error?: string;
  bookmark?: HatenaBookmarkGetResponse;
  title?: string;
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

  // Parse title from metadata
  let title: string | undefined;
  if (metaResult && isMetaExtractionResult(metaResult)) {
    title = metaResult.title || metaResult.og?.title || metaResult.twitter?.title;
  }

  // Handle bookmark response
  if (bookmarkResponse.status === 404) {
    // Bookmark doesn't exist yet - that's okay for new bookmarks
    return { success: true, bookmark: undefined, title };
  }

  if (!bookmarkResponse.ok) {
    const errorText = await bookmarkResponse.text();
    return { success: false, error: `Hatena API error: ${bookmarkResponse.status} - ${errorText}` };
  }

  const bookmark = (await bookmarkResponse.json()) as HatenaBookmarkGetResponse;
  return { success: true, bookmark, title };
}

function BookmarkDetailLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
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
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-3">
          <Bookmark className="w-12 h-12 text-primary" />
        </div>
        <CardTitle className="text-xl">Edit Bookmark</CardTitle>
      </CardHeader>
      <CardContent>
        <Suspense key={bookmarkUrl} fallback={<BookmarkDetailLoading />}>
          <BookmarkDetailContent bookmarkUrl={bookmarkUrl} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
