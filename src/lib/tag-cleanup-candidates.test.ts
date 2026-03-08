import { describe, expect, it } from "vitest";
import {
  materializeTagCleanupCandidates,
  normalizeCandidateAction,
} from "./tag-cleanup-candidates";

describe("normalizeCandidateAction", () => {
  it("downgrades empty update targets to delete", () => {
    expect(normalizeCandidateAction("update", "")).toBe("delete");
    expect(normalizeCandidateAction("update", null)).toBe("delete");
  });

  it("keeps update when target exists", () => {
    expect(normalizeCandidateAction("update", "記事")).toBe("update");
  });
});

describe("materializeTagCleanupCandidates", () => {
  const tagInventory = [
    { tag: "article", count: 10 },
    { tag: "記事", count: 20 },
    { tag: "guide", count: 5 },
  ];

  it("maps generated candidates onto existing inventory metadata", () => {
    expect(
      materializeTagCleanupCandidates(
        [
          {
            sourceTag: "article",
            action: "update",
            targetTag: "記事",
            reason: "merge",
          },
        ],
        tagInventory,
      ),
    ).toEqual([
      {
        sourceTag: "article",
        action: "update",
        targetTag: "記事",
        reason: "merge",
        sourceCount: 10,
        targetCount: 20,
        suggested: true,
      },
    ]);
  });

  it("drops unknown source tags and deduplicates source tags case-insensitively", () => {
    expect(
      materializeTagCleanupCandidates(
        [
          {
            sourceTag: "unknown",
            action: "delete",
            reason: "ignore",
          },
          {
            sourceTag: "Guide",
            action: "delete",
            reason: "first wins",
          },
          {
            sourceTag: "guide",
            action: "update",
            targetTag: "記事",
            reason: "duplicate should be skipped",
          },
        ],
        tagInventory,
      ),
    ).toEqual([
      {
        sourceTag: "guide",
        action: "delete",
        targetTag: undefined,
        reason: "first wins",
        sourceCount: 5,
        targetCount: 0,
        suggested: true,
      },
    ]);
  });
});
