import { createSignedRequest } from "./hatena-oauth";
import {
  extractCommentText,
  extractTagsFromComment,
  sanitizeBookmarkTags,
} from "./bookmark-comment";
import { isBookmarkRequestWithinLimit } from "./hatena-body-limit";
import type {
  HatenaTag,
  HatenaTagsResponse,
  TagCleanupBookmark,
  TagMappingCandidate,
} from "../types/habu";

const HATENA_TAGS_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/tags";
const HATENA_BOOKMARK_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/bookmark";
const HATENA_FULLTEXT_SEARCH_API_URL = "https://b.hatena.ne.jp/my/search/json";
const SEARCH_PAGE_SIZE = 100;

export interface HatenaApiCredentials {
  accessToken: string;
  accessTokenSecret: string;
  consumerKey: string;
  consumerSecret: string;
}

interface HatenaSearchBookmarkItem {
  url?: string;
  title?: string;
  comment?: string;
  timestamp?: number;
  is_private?: number | boolean;
  entry?: {
    url?: string;
    title?: string;
  };
}

interface HatenaSearchResponse {
  meta?: {
    total?: number;
  };
  bookmarks?: HatenaSearchBookmarkItem[];
}

export function buildHatenaSearchUrl(query: string, offset: number, limit: number): string {
  return `${HATENA_FULLTEXT_SEARCH_API_URL}?q=${encodeURIComponent(query)}&of=${offset}&limit=${limit}`;
}

function buildFormBody(params: Record<string, string | string[] | undefined>) {
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => body.append(key, item));
      continue;
    }
    body.append(key, value);
  }

  return body;
}

export function replaceBookmarkTag(tags: string[], sourceTag: string, targetTag: string) {
  const next = tags
    .map((tag) => (tag === sourceTag ? targetTag : tag))
    .filter((tag) => tag.trim().length > 0);

  return sanitizeBookmarkTags(next);
}

export function applyTagMappings(tags: string[], mappings: TagMappingCandidate[]) {
  const mappingMap = new Map(mappings.map((mapping) => [mapping.sourceTag, mapping] as const));
  const matchedSourceTags: string[] = [];
  const nextTags: string[] = [];

  for (const tag of tags) {
    const mapping = mappingMap.get(tag);
    if (!mapping) {
      nextTags.push(tag);
      continue;
    }

    matchedSourceTags.push(mapping.sourceTag);

    if (mapping.action === "delete") {
      continue;
    }

    if (mapping.action === "update" && mapping.targetTag?.trim()) {
      nextTags.push(mapping.targetTag.trim());
      continue;
    }

    nextTags.push(tag);
  }

  return {
    nextTags: sanitizeBookmarkTags(nextTags),
    matchedSourceTags: [...new Set(matchedSourceTags)],
  };
}

export async function fetchHatenaTags(credentials: HatenaApiCredentials): Promise<HatenaTag[]> {
  const authHeaders = createSignedRequest(
    HATENA_TAGS_API_URL,
    "GET",
    credentials.accessToken,
    credentials.accessTokenSecret,
    credentials.consumerKey,
    credentials.consumerSecret,
  );

  const response = await fetch(HATENA_TAGS_API_URL, {
    method: "GET",
    headers: authHeaders,
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("Location");
    throw new Error(`Hatena Tags API redirect detected: ${response.status} -> ${location}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hatena Tags API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as HatenaTagsResponse;
  return [...data.tags].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ja"));
}

async function searchBookmarksPage(
  credentials: HatenaApiCredentials,
  query: string,
  offset: number,
  limit: number,
): Promise<{ total: number; bookmarks: TagCleanupBookmark[] }> {
  const apiUrl = buildHatenaSearchUrl(query, offset, limit);
  const authHeaders = createSignedRequest(
    apiUrl,
    "GET",
    credentials.accessToken,
    credentials.accessTokenSecret,
    credentials.consumerKey,
    credentials.consumerSecret,
  );

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: authHeaders,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hatena Search API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as HatenaSearchResponse;
  const bookmarks: TagCleanupBookmark[] = [];

  for (const bookmark of data.bookmarks ?? []) {
    const url = bookmark.entry?.url || bookmark.url;
    if (!url) continue;

    const title = bookmark.entry?.title || bookmark.title || url;
    const rawComment = bookmark.comment || "";
    const currentTags = extractTagsFromComment(rawComment);
    const commentText = extractCommentText(rawComment);

    bookmarks.push({
      url,
      title,
      commentText,
      currentTags,
      nextTags: currentTags,
      isPrivate: bookmark.is_private === 1 || bookmark.is_private === true,
      bookmarkedAt: bookmark.timestamp
        ? new Date(bookmark.timestamp * 1000).toISOString()
        : undefined,
    });
  }

  return {
    total: data.meta?.total ?? bookmarks.length,
    bookmarks,
  };
}

export async function findBookmarksByTag(
  credentials: HatenaApiCredentials,
  sourceTag: string,
): Promise<TagCleanupBookmark[]> {
  const matches: TagCleanupBookmark[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const page = await searchBookmarksPage(credentials, sourceTag, offset, SEARCH_PAGE_SIZE);
    total = page.total;

    const exactMatches = page.bookmarks.filter((bookmark) =>
      bookmark.currentTags.includes(sourceTag),
    );

    for (const bookmark of exactMatches) {
      if (seen.has(bookmark.url)) continue;
      seen.add(bookmark.url);
      matches.push(bookmark);
    }

    if (page.bookmarks.length < SEARCH_PAGE_SIZE) {
      break;
    }

    offset += SEARCH_PAGE_SIZE;
  }

  return matches;
}

export async function updateBookmarkTags(
  credentials: HatenaApiCredentials,
  input: {
    url: string;
    commentText: string;
    tags: string[];
    isPrivate: boolean;
  },
) {
  const tags = sanitizeBookmarkTags(input.tags);
  const commentText = input.commentText.trim();
  const signParams: Record<string, string | string[]> = {
    url: input.url,
    comment: commentText,
    tags,
  };
  const bodyParams: Record<string, string | string[] | undefined> = {
    ...signParams,
    private: input.isPrivate ? "1" : undefined,
  };

  if (!isBookmarkRequestWithinLimit(input.url, commentText, tags, input.isPrivate)) {
    throw new Error("Bookmark body is too long for Hatena API");
  }

  if (input.isPrivate) {
    signParams.private = "1";
  }

  const authHeaders = createSignedRequest(
    HATENA_BOOKMARK_API_URL,
    "POST",
    credentials.accessToken,
    credentials.accessTokenSecret,
    credentials.consumerKey,
    credentials.consumerSecret,
    signParams,
  );

  const response = await fetch(HATENA_BOOKMARK_API_URL, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: buildFormBody(bodyParams).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hatena Bookmark API error: ${response.status} - ${errorText}`);
  }
}
