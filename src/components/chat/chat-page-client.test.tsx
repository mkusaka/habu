// @vitest-environment happy-dom

import assert from "node:assert/strict";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPageClient } from "./chat-page-client";

vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    stop: vi.fn(),
    status: "ready",
    error: undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ChatPageClient", () => {
  it("uses icon-only controls in the session header", () => {
    render(
      <ChatPageClient
        sessionId="session-1"
        selectedUrl="https://example.com/article"
        context={{ url: "https://example.com/article" }}
        initialMessages={[]}
        historyThreads={[]}
        title="Example"
      />,
    );

    expect(screen.queryByText("Open Search Menu")).toBeNull();
    expect(screen.queryByText("Search Home")).toBeNull();
    assert.ok(screen.getByRole("button", { name: "Show search controls" }));
    assert.ok(screen.getByRole("link", { name: "Histories" }));
    assert.ok(screen.getByRole("link", { name: "Open Bookmark Detail" }));
    assert.ok(screen.getByRole("link", { name: "Open Page" }));
  });
});
