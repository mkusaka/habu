// @vitest-environment happy-dom

import assert from "node:assert/strict";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import { ChatMessages } from "./chat-messages";

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("ChatMessages", () => {
  it("renders assistant sources and bookmark search results as structured UI", () => {
    const messages = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "source-url",
            sourceId: "source-1",
            url: "https://example.com/guide",
            title: "Design Guide",
          },
          {
            type: "tool-search_bookmarks",
            toolCallId: "tool-1",
            state: "output-available",
            input: {
              query: "design systems",
              limit: 5,
              offset: 0,
            },
            output: {
              query: "design systems",
              total: 1,
              bookmarks: [
                {
                  url: "https://example.com/guide",
                  title: "Design Systems Guide",
                  comment: "Useful references for UI work.",
                  tags: ["ui", "design"],
                  bookmarkedAt: "2026-04-20T10:00:00.000Z",
                  isPrivate: false,
                  bookmarkCount: 42,
                },
              ],
            },
          },
          {
            type: "text",
            text: "I found a matching bookmark with design references.",
          },
        ],
      } as unknown as UIMessage,
    ];

    render(<ChatMessages messages={messages} />);

    assert.ok(screen.getByText("Sources"));
    assert.ok(screen.getByRole("link", { name: "Design Guide" }));
    assert.ok(screen.getByText("1 saved match"));
    assert.ok(screen.getByRole("link", { name: "Design Systems Guide" }));
    assert.ok(screen.getByText("#ui"));
    assert.ok(screen.getByText("Useful references for UI work."));
    assert.ok(screen.getByText("I found a matching bookmark with design references."));
  });

  it("renders tag results as badges", () => {
    const messages = [
      {
        id: "assistant-2",
        role: "assistant",
        parts: [
          {
            type: "tool-list_tags",
            toolCallId: "tool-2",
            state: "output-available",
            input: { limit: 3 },
            output: {
              tags: [
                { tag: "react", count: 12 },
                { tag: "ai", count: 8 },
              ],
            },
          },
        ],
      } as unknown as UIMessage,
    ];

    render(<ChatMessages messages={messages} />);

    expect(screen.getByText("Top saved tags")).toBeTruthy();
    expect(screen.getByText("#react")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("#ai")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
  });

  it("prefers server-driven tool summary parts over raw tool cards", () => {
    const messages = [
      {
        id: "assistant-3",
        role: "assistant",
        parts: [
          {
            type: "tool-list_tags",
            toolCallId: "tool-3",
            state: "output-available",
            input: { limit: 2 },
            output: {
              tags: [
                { tag: "nextjs", count: 5 },
                { tag: "pwa", count: 3 },
              ],
            },
          },
          {
            type: "data-tool-summary",
            id: "tool-3",
            data: {
              kind: "tag-results",
              toolCallId: "tool-3",
              toolName: "list_tags",
              title: "Top saved tags",
              description: "Showing 2 tags from the connected Hatena account.",
              tags: [
                { tag: "nextjs", count: 5 },
                { tag: "pwa", count: 3 },
              ],
            },
          },
        ],
      } as unknown as UIMessage,
    ];

    render(<ChatMessages messages={messages} />);

    expect(screen.getAllByText("Top saved tags")).toHaveLength(2);
    expect(screen.getByText("#nextjs")).toBeTruthy();
  });
});
