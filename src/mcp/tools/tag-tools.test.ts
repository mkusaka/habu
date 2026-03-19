import { fetchMock } from "../../test-utils/fetch-mock";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { McpContext } from "../types";
import { filterBookmarksByTags } from "./filter-bookmarks-by-tags";
import { listTags } from "./list-tags";

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

describe("listTags", () => {
  it("returns sorted Hatena tags", async () => {
    fetchMock
      .get("https://bookmark.hatenaapis.com")
      .intercept({ path: "/rest/1/my/tags", method: "GET" })
      .reply(
        200,
        JSON.stringify({
          tags: [
            { tag: "zeta", count: 1 },
            { tag: "alpha", count: 5 },
          ],
        }),
        { headers: { "content-type": "application/json; charset=utf-8" } },
      );

    const result = await listTags({ limit: 10 }, baseContext, {
      HATENA_CONSUMER_KEY: "key",
      HATENA_CONSUMER_SECRET: "secret",
    });

    expect(result).toEqual({
      success: true,
      data: {
        tags: [
          { tag: "alpha", count: 5 },
          { tag: "zeta", count: 1 },
        ],
      },
    });
  });
});

describe("filterBookmarksByTags", () => {
  it("returns bookmarks for the requested tags", async () => {
    fetchMock
      .get("https://bookmark.hatenaapis.com")
      .intercept({ path: "/rest/1/my", method: "GET" })
      .reply(200, JSON.stringify({ name: "mkusaka" }), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });

    fetchMock
      .get("https://b.hatena.ne.jp")
      .intercept({
        path: "/api/users/mkusaka/bookmarks?page=1&tag=AI%E8%A6%81%E7%B4%84",
        method: "GET",
      })
      .reply(
        200,
        JSON.stringify({
          item: {
            bookmarks: [
              {
                url: "https://example.com/entry",
                comment: "useful note",
                tags: ["AI要約"],
                created: "2026-03-08T00:00:00+09:00",
                entry: {
                  title: "Example Entry",
                  canonical_url: "https://example.com/entry",
                },
              },
            ],
          },
        }),
        { headers: { "content-type": "application/json; charset=utf-8" } },
      );

    const result = await filterBookmarksByTags({ tags: ["AI要約"], page: 1 }, baseContext, {
      HATENA_CONSUMER_KEY: "key",
      HATENA_CONSUMER_SECRET: "secret",
    });

    expect(result).toEqual({
      success: true,
      data: {
        tags: ["AI要約"],
        page: 1,
        username: "mkusaka",
        bookmarks: [
          {
            url: "https://example.com/entry",
            title: "Example Entry",
            comment: "useful note",
            tags: ["AI要約"],
            bookmarkedAt: "2026-03-08T00:00:00+09:00",
          },
        ],
      },
    });
  });
});
