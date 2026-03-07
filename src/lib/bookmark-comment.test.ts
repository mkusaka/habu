import { describe, expect, it } from "vitest";
import {
  extractCommentText,
  extractTagsFromComment,
  formatCommentWithTags,
  parseTaggedComment,
  sanitizeBookmarkTags,
} from "./bookmark-comment";

describe("bookmark-comment", () => {
  it("extracts tags and comment text from tagged comments", () => {
    expect(parseTaggedComment("[React][Next.js]Server Components")).toEqual({
      tags: ["React", "Next.js"],
      commentText: "Server Components",
    });
  });

  it("returns empty text when comment only contains tags", () => {
    expect(extractTagsFromComment("[foo][bar]")).toEqual(["foo", "bar"]);
    expect(extractCommentText("[foo][bar]")).toBe("");
  });

  it("sanitizes and deduplicates bookmark tags", () => {
    expect(sanitizeBookmarkTags([" React ", "react", "bad/tag", "averylongtaggg"])).toEqual([
      "React",
      "badtag",
    ]);
  });

  it("formats comment text with tag prefixes", () => {
    expect(formatCommentWithTags("A concise note", ["React", "Next.js"])).toBe(
      "[React][Next.js]A concise note",
    );
  });
});
