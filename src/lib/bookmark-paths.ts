import { appendTagFilters } from "@/lib/bookmark-tag-filter";

export function buildBookmarksHref(page: number, tags: readonly string[]) {
  const params = new URLSearchParams();
  if (page > 1) {
    params.set("page", String(page));
  }

  appendTagFilters(params, tags);

  if (params.size === 0) {
    return "/bookmarks";
  }

  return `/bookmarks?${params.toString()}`;
}

export function buildBookmarkDetailHref(url: string, page: number, tags: readonly string[]) {
  const params = new URLSearchParams({ url });
  if (page > 1) {
    params.set("page", String(page));
  }

  appendTagFilters(params, tags);
  return `/bookmarks/detail?${params.toString()}`;
}
