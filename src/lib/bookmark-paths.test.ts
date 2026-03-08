import { describe, expect, it } from "vitest";
import { buildBookmarkDetailHref, buildBookmarksHref } from "./bookmark-paths";

describe("buildBookmarksHref", () => {
  it("returns the base bookmarks path when no params are present", () => {
    expect(buildBookmarksHref(1, [])).toBe("/bookmarks");
  });

  it("preserves page and repeated tag filters", () => {
    expect(buildBookmarksHref(2, ["AI要約", "2025"])).toBe(
      "/bookmarks?page=2&tag=AI%E8%A6%81%E7%B4%84&tag=2025",
    );
  });
});

describe("buildBookmarkDetailHref", () => {
  it("encodes the bookmark URL and optional paging filters", () => {
    expect(buildBookmarkDetailHref("https://example.com/a?b=1", 3, ["React"])).toBe(
      "/bookmarks/detail?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1&page=3&tag=React",
    );
  });
});
