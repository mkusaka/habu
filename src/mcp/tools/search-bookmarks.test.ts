import { fetchMock } from "../../test-utils/fetch-mock";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { searchBookmarks } from "./search-bookmarks";
import type { McpContext } from "../types";
import * as hatenaOauth from "../../lib/hatena-oauth";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

const baseContext: McpContext = {
  userId: "user-1",
  hatenaId: "hatena-user",
  scopes: ["bookmark:read"],
  hatenaToken: {
    accessToken: "access-token",
    accessTokenSecret: "access-token-secret",
  },
};

describe("searchBookmarks", () => {
  it("returns permission denied without bookmark:read scope", async () => {
    const result = await searchBookmarks(
      { query: "ai", limit: 10, offset: 0 },
      { ...baseContext, scopes: [] },
      { HATENA_CONSUMER_KEY: "key", HATENA_CONSUMER_SECRET: "secret" },
    );

    expect(result).toEqual({
      success: false,
      error: "Permission denied: bookmark:read scope required",
    });
  });

  it("encodes spaces as %20 (not +) in query to avoid OAuth signature mismatch", async () => {
    const spy = vi.spyOn(hatenaOauth, "createSignedRequest").mockReturnValue({
      Authorization: "OAuth mock",
    });

    fetchMock
      .get("https://b.hatena.ne.jp")
      .intercept({ path: /\/my\/search\/json\?/, method: "GET" })
      .reply(200, JSON.stringify({ meta: { total: 0 }, bookmarks: [] }), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });

    await searchBookmarks({ query: "codex rate limit", limit: 10, offset: 0 }, baseContext, {
      HATENA_CONSUMER_KEY: "key",
      HATENA_CONSUMER_SECRET: "secret",
    });

    const calledUrl = spy.mock.calls[0][0];
    expect(calledUrl).toContain("q=codex%20rate%20limit");
    expect(calledUrl).not.toContain("q=codex+rate+limit");

    spy.mockRestore();
  });

  it("maps Hatena search results into bookmark items", async () => {
    fetchMock
      .get("https://b.hatena.ne.jp")
      .intercept({ path: /\/my\/search\/json\?/, method: "GET" })
      .reply(
        200,
        JSON.stringify({
          meta: { total: 1 },
          bookmarks: [
            {
              entry: {
                title: "Agentic Search",
                url: "https://example.com/agentic-search",
                snippet: "overview of agentic search",
                count: 42,
              },
              comment: "[ai][search]Great overview",
              timestamp: 1762502400,
              is_private: 0,
            },
          ],
        }),
        { headers: { "content-type": "application/json; charset=utf-8" } },
      );

    const result = await searchBookmarks({ query: "agentic", limit: 10, offset: 0 }, baseContext, {
      HATENA_CONSUMER_KEY: "key",
      HATENA_CONSUMER_SECRET: "secret",
    });

    expect(result).toEqual({
      success: true,
      data: {
        query: "agentic",
        total: 1,
        bookmarks: [
          {
            url: "https://example.com/agentic-search",
            title: "Agentic Search",
            comment: "Great overview",
            tags: ["ai", "search"],
            snippet: "overview of agentic search",
            bookmarkedAt: "2025-11-07T08:00:00.000Z",
            isPrivate: false,
            bookmarkCount: 42,
          },
        ],
      },
    });
  });
});
