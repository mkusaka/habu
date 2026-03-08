// @vitest-environment happy-dom

import assert from "node:assert/strict";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchHistoriesClient } from "./search-histories-client";

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
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

const historyThreads = [
  {
    id: "history-1",
    title: "History 1",
    query: "first query",
    url: "https://example.com/1",
    updatedAt: new Date("2026-03-08T00:00:00Z"),
    messageCount: 2,
    lastMessagePreview: "preview one",
  },
  {
    id: "history-2",
    title: "History 2",
    query: "second query",
    url: "https://example.com/2",
    updatedAt: new Date("2026-03-07T00:00:00Z"),
    messageCount: 4,
    lastMessagePreview: "preview two",
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SearchHistoriesClient", () => {
  it("shows all history items and opens the selected session", () => {
    render(<SearchHistoriesClient historyThreads={historyThreads} />);

    assert.ok(screen.getByText("2 saved conversations"));
    assert.ok(screen.getByRole("button", { name: /History 1/i }));
    assert.ok(screen.getByRole("button", { name: /History 2/i }));

    fireEvent.click(screen.getByRole("button", { name: /History 2/i }));

    expect(pushMock).toHaveBeenCalledWith("/search/history-2");
  });

  it("shows an empty state when there are no saved conversations", () => {
    render(<SearchHistoriesClient historyThreads={[]} />);

    assert.ok(screen.getByText("No saved conversations yet."));
    assert.equal(
      screen.getByRole("link", { name: /Open Search/i }).getAttribute("href"),
      "/search",
    );
  });
});
