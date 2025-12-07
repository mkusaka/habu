import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSignedRequest } from "@/lib/hatena-oauth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bookmark, Home, AlertCircle } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { BookmarkList } from "./bookmark-list";

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

export interface BookmarkItem {
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

async function fetchBookmarks(offset: number): Promise<FetchBookmarksResult> {
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

  // Fetch bookmarks using unofficial API
  const bookmarksApiUrl = `https://b.hatena.ne.jp/api/users/${username}/bookmarks?limit=${PAGE_SIZE}&offset=${offset}`;

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

interface BookmarksPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function BookmarksPage({ searchParams }: BookmarksPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const result = await fetchBookmarks(offset);

  if (!result.success) {
    return (
      <main className="min-h-screen p-4 flex items-start justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <Bookmark className="w-6 h-6 text-primary" />
              <CardTitle className="text-xl">My Bookmarks</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-md text-sm text-red-800 dark:text-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{result.error}</span>
            </div>
            <div className="pt-4 border-t">
              <LinkButton href="/" variant="outline" className="w-full" size="sm">
                <Home className="w-4 h-4 mr-2" />
                Home
              </LinkButton>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const bookmarks = result.bookmarks || [];
  const hasMore = bookmarks.length === PAGE_SIZE;

  return (
    <main className="min-h-screen p-4 flex items-start justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bookmark className="w-6 h-6 text-primary" />
              <div>
                <CardTitle className="text-xl">My Bookmarks</CardTitle>
                {result.username && (
                  <p className="text-xs text-muted-foreground">@{result.username}</p>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <BookmarkList bookmarks={bookmarks} page={page} hasMore={hasMore} />

          {/* Navigation */}
          <div className="pt-4 border-t">
            <LinkButton href="/" variant="outline" className="w-full" size="sm">
              <Home className="w-4 h-4 mr-2" />
              Home
            </LinkButton>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
