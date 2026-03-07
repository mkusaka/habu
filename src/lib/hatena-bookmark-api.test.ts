import { describe, expect, it } from "vitest";
import { replaceBookmarkTag } from "./hatena-bookmark-api";

describe("replaceBookmarkTag", () => {
  it("replaces the source tag and preserves order", () => {
    expect(replaceBookmarkTag(["React", "TypeScript"], "React", "frontend")).toEqual([
      "frontend",
      "TypeScript",
    ]);
  });

  it("deduplicates when the target tag already exists", () => {
    expect(replaceBookmarkTag(["React", "frontend", "TypeScript"], "React", "frontend")).toEqual([
      "frontend",
      "TypeScript",
    ]);
  });
});
