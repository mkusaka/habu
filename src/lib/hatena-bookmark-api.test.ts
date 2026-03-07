import { describe, expect, it } from "vitest";
import { applyTagMappings, replaceBookmarkTag } from "./hatena-bookmark-api";

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

  it("applies mixed update, delete, and no-change mappings in one pass", () => {
    expect(
      applyTagMappings(
        ["before1", "before2", "before3", "before4"],
        [
          { sourceTag: "before1", action: "no_change" },
          { sourceTag: "before2", action: "update", targetTag: "after1" },
          { sourceTag: "before3", action: "update", targetTag: "before1" },
          { sourceTag: "before4", action: "delete" },
        ],
      ),
    ).toEqual({
      nextTags: ["before1", "after1"],
      matchedSourceTags: ["before1", "before2", "before3", "before4"],
    });
  });

  it("treats case-only variants as distinct source tags", () => {
    expect(
      applyTagMappings(
        ["Agents", "agents"],
        [
          { sourceTag: "Agents", action: "update", targetTag: "AI Agents" },
          { sourceTag: "agents", action: "delete" },
        ],
      ),
    ).toEqual({
      nextTags: ["AI Agents"],
      matchedSourceTags: ["Agents", "agents"],
    });
  });
});
