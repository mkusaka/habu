// @vitest-environment happy-dom

import assert from "node:assert/strict";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchLandingClient } from "./search-landing-client";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const recentBookmarks = [
  {
    url: "https://example.com/recent",
    title: "Recent Pick",
    comment: "saved comment",
    tags: ["AI要約", "設計"],
    bookmarkedAt: "2026-03-08T00:00:00+09:00",
  },
];

const historyThreads = [
  {
    id: "history-1",
    title: "History 1",
    query: "search one",
    url: "https://example.com/one",
    updatedAt: new Date("2026-03-08T00:00:00Z"),
    messageCount: 3,
    lastMessagePreview: "preview one",
  },
  {
    id: "history-2",
    title: "History 2",
    query: "search two",
    url: "https://example.com/two",
    updatedAt: new Date("2026-03-07T00:00:00Z"),
    messageCount: 2,
    lastMessagePreview: "preview two",
  },
];

beforeEach(() => {
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn(() => "session-123"),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SearchLandingClient", () => {
  it("shows and clears an initially selected bookmark card", () => {
    render(
      <SearchLandingClient
        initialUrl="https://example.com/recent"
        recentBookmarks={recentBookmarks}
        selectedBookmark={recentBookmarks[0]}
        historyThreads={historyThreads}
      />,
    );

    assert.ok(screen.getByText("Selected Bookmark"));
    assert.ok(screen.getByText("saved comment"));
    assert.ok(screen.getByText("AI要約"));

    fireEvent.click(screen.getByRole("button", { name: /Recent Pick/i }));

    expect(screen.queryByText("Selected Bookmark")).toBeNull();
    assert.ok(screen.getByText("Recent Bookmarks"));
  });

  it("starts a session immediately when a recent bookmark is clicked", () => {
    render(
      <SearchLandingClient
        initialUrl={undefined}
        recentBookmarks={recentBookmarks}
        historyThreads={historyThreads}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Recent Pick/i }));

    expect(pushMock).toHaveBeenCalledWith(
      "/search/session-123?url=https%3A%2F%2Fexample.com%2Frecent",
    );
  });

  it("starts a session from a quick start card with the selected URL", () => {
    render(
      <SearchLandingClient
        initialUrl="https://example.com/recent"
        recentBookmarks={recentBookmarks}
        selectedBookmark={recentBookmarks[0]}
        historyThreads={historyThreads}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /What did I already bookmark that relates to this URL\?/i,
      }),
    );

    expect(pushMock).toHaveBeenCalledWith(
      "/search/session-123?q=What+did+I+already+bookmark+that+relates+to+this+URL%3F&url=https%3A%2F%2Fexample.com%2Frecent",
    );
  });

  it("opens a recent history session from the side list", () => {
    render(
      <SearchLandingClient
        initialUrl={undefined}
        recentBookmarks={recentBookmarks}
        historyThreads={historyThreads}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /History 1/i }));

    expect(pushMock).toHaveBeenCalledWith("/search/history-1");
  });
});
