import { describe, expect, it } from "vitest";
import { appendTagFilters, normalizeTagFilters } from "./bookmark-tag-filter";

describe("normalizeTagFilters", () => {
  it("trims empty values and de-duplicates tags", () => {
    expect(normalizeTagFilters([" article ", "", "AI要約", "article", "AI要約"])).toEqual([
      "article",
      "AI要約",
    ]);
  });

  it("accepts a single tag string", () => {
    expect(normalizeTagFilters(" 2025 ")).toEqual(["2025"]);
  });
});

describe("appendTagFilters", () => {
  it("appends repeated tag parameters in order", () => {
    const params = new URLSearchParams({ page: "2" });
    appendTagFilters(params, ["AI要約", "2025"]);

    expect(params.toString()).toBe("page=2&tag=AI%E8%A6%81%E7%B4%84&tag=2025");
  });
});
