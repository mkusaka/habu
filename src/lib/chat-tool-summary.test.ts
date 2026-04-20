import { describe, expect, it } from "vitest";
import { buildChatToolSummary, isChatToolSummaryData } from "./chat-tool-summary";

describe("buildChatToolSummary", () => {
  it("builds bookmark result summaries for bookmark search", () => {
    const summary = buildChatToolSummary({
      toolCallId: "tool-1",
      toolName: "search_bookmarks",
      input: { query: "generative ui" },
      output: {
        query: "generative ui",
        total: 1,
        bookmarks: [
          {
            url: "https://example.com/ui",
            title: "Generative UI Notes",
            comment: "Useful reference",
            tags: ["ui"],
          },
        ],
      },
      durationMs: 123,
    });

    expect(summary.kind).toBe("bookmark-results");
    expect(summary.title).toBe("1 saved match");
    expect(summary.description).toBe("Query: generative ui");
    expect(isChatToolSummaryData(summary)).toBe(true);
  });

  it("builds error summaries for failed tool calls", () => {
    const summary = buildChatToolSummary({
      toolCallId: "tool-2",
      toolName: "fetch_markdown",
      input: { url: "https://example.com" },
      error: new Error("Fetch failed"),
      durationMs: 87,
    });

    expect(summary.kind).toBe("tool-error");
    if (summary.kind !== "tool-error") {
      throw new Error("Expected tool-error summary");
    }
    expect(summary.title).toBe("Fetch Markdown");
    expect(summary.error).toBe("Fetch failed");
    expect(isChatToolSummaryData(summary)).toBe(true);
  });
});
