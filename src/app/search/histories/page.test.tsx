// @vitest-environment happy-dom

import assert from "node:assert/strict";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookiesMock,
  getSessionMock,
  buildMcpContextForUserMock,
  listChatThreadsForHatenaAccountMock,
  searchHistoriesClientMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  getSessionMock: vi.fn(),
  buildMcpContextForUserMock: vi.fn(),
  listChatThreadsForHatenaAccountMock: vi.fn(),
  searchHistoriesClientMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({
    env: {
      DB: {},
    },
  }),
}));

vi.mock("@/lib/auth", () => ({
  createAuth: () => ({
    api: {
      getSession: getSessionMock,
    },
  }),
}));

vi.mock("@/lib/bookmark-user-context", () => ({
  buildMcpContextForUser: buildMcpContextForUserMock,
}));

vi.mock("@/lib/chat-history", () => ({
  listChatThreadsForHatenaAccount: listChatThreadsForHatenaAccountMock,
}));

vi.mock("@/components/chat/search-histories-client", () => ({
  SearchHistoriesClient: searchHistoriesClientMock,
}));

vi.mock("@/components/ui/link-button", () => ({
  LinkButton: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import SearchHistoriesPage from "./page";

beforeEach(() => {
  cookiesMock.mockResolvedValue({
    toString: () => "session=abc",
  });
  getSessionMock.mockReset();
  buildMcpContextForUserMock.mockReset();
  listChatThreadsForHatenaAccountMock.mockReset();
  searchHistoriesClientMock.mockReset();
  searchHistoriesClientMock.mockImplementation(
    ({ historyThreads }: { historyThreads: Array<{ id: string }> }) => (
      <div>history-count:{historyThreads.length}</div>
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SearchHistoriesPage", () => {
  it("shows a sign-in message when the user is not authenticated", async () => {
    getSessionMock.mockResolvedValue(null);

    render(await SearchHistoriesPage());

    assert.ok(screen.getByText("You need to sign in to use page search."));
    expect(buildMcpContextForUserMock).not.toHaveBeenCalled();
  });

  it("shows settings guidance when Hatena is not connected", async () => {
    getSessionMock.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });
    buildMcpContextForUserMock.mockResolvedValue(null);

    render(await SearchHistoriesPage());

    assert.ok(screen.getByText("Connect your Hatena account to use bookmark search."));
    expect(listChatThreadsForHatenaAccountMock).not.toHaveBeenCalled();
  });

  it("passes saved history threads to the client component", async () => {
    const historyThreads = [
      {
        id: "thread-1",
        title: "History 1",
        updatedAt: new Date("2026-03-09T00:00:00Z"),
        messageCount: 2,
        lastMessagePreview: "preview",
      },
    ];

    getSessionMock.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });
    buildMcpContextForUserMock.mockResolvedValue({
      hatenaId: "hatena-user",
    });
    listChatThreadsForHatenaAccountMock.mockResolvedValue(historyThreads);

    render(await SearchHistoriesPage());

    assert.ok(screen.getByText("history-count:1"));
    expect(listChatThreadsForHatenaAccountMock).toHaveBeenCalledWith("hatena-user", {});
  });
});
