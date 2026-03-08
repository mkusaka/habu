// @vitest-environment happy-dom

import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

import { TagMappingGraph, type MappingGraphRow } from "./tag-mapping-graph";

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

const rows: MappingGraphRow[] = [
  { sourceTag: "article", sourceCount: 10, action: "update", targetTag: "記事", targetCount: 20 },
  { sourceTag: "blog", sourceCount: 5, action: "update", targetTag: "記事", targetCount: 20 },
  { sourceTag: "guide", sourceCount: 7, action: "update", targetTag: "ガイド", targetCount: 9 },
];

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TagMappingGraph", () => {
  it("highlights one exact mapping when a before node is clicked", async () => {
    render(<TagMappingGraph rows={rows} hatenaId="mkusaka" />);

    const sourceArticle = screen.getByTitle("Highlight article");
    const sourceGuide = screen.getByTitle("Highlight guide");

    fireEvent.click(sourceArticle);

    assert.match(sourceArticle.className, /border-primary/);
    assert.match(sourceGuide.className, /opacity-35/);
  });

  it("highlights incoming mappings when an after node is clicked", async () => {
    render(<TagMappingGraph rows={rows} hatenaId="mkusaka" />);

    const targetArticle = screen.getByTitle("Highlight mappings to 記事");
    const sourceGuide = screen.getByTitle("Highlight guide");
    const sourceArticle = screen.getByTitle("Highlight article");
    const sourceBlog = screen.getByTitle("Highlight blog");

    fireEvent.click(targetArticle);

    assert.match(targetArticle.className, /border-primary/);
    assert.doesNotMatch(sourceArticle.className, /opacity-35/);
    assert.doesNotMatch(sourceBlog.className, /opacity-35/);
    assert.match(sourceGuide.className, /opacity-35/);
  });

  it("copies via the icon without changing highlight state", async () => {
    render(<TagMappingGraph rows={rows} hatenaId="mkusaka" />);

    const targetArticle = screen.getByTitle("Highlight mappings to 記事");
    const copyButton = screen.getByTitle("Copy 記事");

    fireEvent.pointerDown(copyButton);
    fireEvent.click(copyButton);

    assert.deepEqual(vi.mocked(globalThis.navigator.clipboard.writeText).mock.calls, [["記事"]]);
    assert.doesNotMatch(targetArticle.className, /border-primary/);
  });
});
