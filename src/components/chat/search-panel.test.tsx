// @vitest-environment happy-dom

import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchPanel } from "./search-panel";

const historyThreads = Array.from({ length: 6 }).map((_, index) => ({
  id: `history-${index + 1}`,
  title: `History ${index + 1}`,
  query: `query ${index + 1}`,
  url: `https://example.com/${index + 1}`,
  updatedAt: new Date("2026-03-08T00:00:00Z"),
  messageCount: index + 1,
  lastMessagePreview: `preview ${index + 1}`,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SearchPanel", () => {
  it("hides the query input when showQueryInput is false", () => {
    render(
      <SearchPanel
        activeSessionId="history-1"
        queryInput=""
        urlInput="https://example.com"
        historyThreads={historyThreads}
        showQueryInput={false}
        onQueryChange={() => {}}
        onUrlChange={() => {}}
        onStartSearch={(e) => e.preventDefault()}
        onOpenSearch={() => {}}
      />,
    );

    expect(screen.queryByText("Search query")).toBeNull();
    assert.ok(screen.getByText("Page URL (optional)"));
  });

  it("shows only five recent history items by default", () => {
    render(
      <SearchPanel
        activeSessionId={undefined}
        queryInput=""
        urlInput=""
        historyThreads={historyThreads}
        onQueryChange={() => {}}
        onUrlChange={() => {}}
        onStartSearch={(e) => e.preventDefault()}
        onOpenSearch={() => {}}
      />,
    );

    expect(screen.queryByRole("button", { name: /History 6/i })).toBeNull();
    assert.ok(screen.getByRole("button", { name: /History 5/i }));
  });

  it("opens the selected history item with its tag/query context", () => {
    const openSearchMock = vi.fn();

    render(
      <SearchPanel
        activeSessionId="history-1"
        queryInput=""
        urlInput=""
        historyThreads={historyThreads}
        onQueryChange={() => {}}
        onUrlChange={() => {}}
        onStartSearch={(e) => e.preventDefault()}
        onOpenSearch={openSearchMock}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /History 2/i }));

    expect(openSearchMock).toHaveBeenCalledWith({
      sessionId: "history-2",
      query: "query 2",
      url: "https://example.com/2",
    });
  });
});
