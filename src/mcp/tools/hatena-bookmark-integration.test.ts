import { fetchMock } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { deleteBookmark } from "./delete-bookmark";
import { getBookmark } from "./get-bookmark";
import { sendHatenaBookmarkRequest } from "./hatena-bookmark-request";
import type { McpContext } from "../types";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

const env = {
  HATENA_CONSUMER_KEY: "consumer-key",
  HATENA_CONSUMER_SECRET: "consumer-secret",
};

const connectedContext: McpContext = {
  userId: "user-1",
  hatenaId: "hatena-user",
  scopes: ["bookmark:read", "bookmark:delete"],
  hatenaToken: {
    accessToken: "access-token",
    accessTokenSecret: "access-secret",
  },
};

describe("sendHatenaBookmarkRequest", () => {
  it("rejects missing scopes before any network call", async () => {
    await expect(
      sendHatenaBookmarkRequest(
        "https://example.com",
        "GET",
        "bookmark:delete",
        { ...connectedContext, scopes: ["bookmark:read"] },
        env,
      ),
    ).resolves.toEqual({
      success: false,
      error: "Permission denied: bookmark:delete scope required",
    });
  });

  it("rejects requests when Hatena is not connected", async () => {
    await expect(
      sendHatenaBookmarkRequest(
        "https://example.com",
        "GET",
        "bookmark:read",
        { ...connectedContext, hatenaToken: null },
        env,
      ),
    ).resolves.toEqual({
      success: false,
      error: "Hatena not connected",
    });
  });

  it("executes a signed request against the Hatena bookmark endpoint", async () => {
    fetchMock
      .get("https://bookmark.hatenaapis.com")
      .intercept({ path: /\/rest\/1\/my\/bookmark\?url=/, method: "GET" })
      .reply(200, { ok: true }, { headers: { "content-type": "application/json" } });

    const result = await sendHatenaBookmarkRequest(
      "https://example.com/a?b=1",
      "GET",
      "bookmark:read",
      connectedContext,
      env,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.apiUrl).toBe(
      "https://bookmark.hatenaapis.com/rest/1/my/bookmark?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1",
    );
    expect(result.data.response.status).toBe(200);
  });
});

describe("getBookmark", () => {
  it("returns not found for 404 responses", async () => {
    fetchMock
      .get("https://bookmark.hatenaapis.com")
      .intercept({ path: /\/rest\/1\/my\/bookmark\?url=/, method: "GET" })
      .reply(404, "");

    await expect(
      getBookmark({ url: "https://example.com" }, connectedContext, env),
    ).resolves.toEqual({
      success: false,
      error: "Bookmark not found",
    });
  });

  it("maps successful Hatena bookmark payloads", async () => {
    fetchMock
      .get("https://bookmark.hatenaapis.com")
      .intercept({ path: /\/rest\/1\/my\/bookmark\?url=/, method: "GET" })
      .reply(
        200,
        {
          url: "https://example.com",
          comment: "hello",
          tags: ["React"],
          created_datetime: "2026-03-08T00:00:00Z",
        },
        { headers: { "content-type": "application/json" } },
      );

    await expect(
      getBookmark({ url: "https://example.com" }, connectedContext, env),
    ).resolves.toEqual({
      success: true,
      data: {
        url: "https://example.com",
        comment: "hello",
        tags: ["React"],
        createdAt: "2026-03-08T00:00:00Z",
      },
    });
  });
});

describe("deleteBookmark", () => {
  it("treats 204 responses as successful deletes", async () => {
    fetchMock
      .get("https://bookmark.hatenaapis.com")
      .intercept({ path: /\/rest\/1\/my\/bookmark\?url=/, method: "DELETE" })
      .reply(204, "");

    await expect(
      deleteBookmark({ url: "https://example.com" }, connectedContext, env),
    ).resolves.toEqual({
      success: true,
      data: {
        url: "https://example.com",
        deleted: true,
      },
    });
  });

  it("surfaces non-ok Hatena errors", async () => {
    fetchMock
      .get("https://bookmark.hatenaapis.com")
      .intercept({ path: /\/rest\/1\/my\/bookmark\?url=/, method: "DELETE" })
      .reply(500, "boom");

    await expect(
      deleteBookmark({ url: "https://example.com" }, connectedContext, env),
    ).resolves.toEqual({
      success: false,
      error: "Hatena API error: 500 - boom",
    });
  });
});
