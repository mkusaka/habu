// @vitest-environment happy-dom

import assert from "node:assert/strict";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPageClient } from "./chat-page-client";

const { sendMessageMock, stopMock, pushMock, refreshMock, chatState } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
  stopMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  chatState: {
    messages: [] as unknown[],
    status: "ready",
    error: undefined as Error | undefined,
  },
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: chatState.messages,
    sendMessage: sendMessageMock,
    stop: stopMock,
    status: chatState.status,
    error: chatState.error,
  }),
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

beforeEach(() => {
  chatState.messages = [];
  chatState.status = "ready";
  chatState.error = undefined;
});

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
    assert.ok(screen.getByRole("button", { name: "Show search options" }));
    assert.ok(screen.getByRole("link", { name: "Histories" }));
    assert.ok(screen.getByRole("link", { name: "Open Bookmark Detail" }));
    assert.ok(screen.getByRole("link", { name: "Open Page" }));
  });

  it("auto-submits the initial prompt for a fresh session", () => {
    render(
      <ChatPageClient
        sessionId="session-1"
        initialQuery="golden ratio ui library"
        initialPrompt="golden ratio ui library"
        context={{ query: "golden ratio ui library" }}
        initialMessages={[]}
        historyThreads={[]}
        title="Search"
      />,
    );

    expect(sendMessageMock).toHaveBeenCalledWith({ text: "golden ratio ui library" });
    expect(screen.queryByText(/^Query:/)).toBeNull();
  });
});
