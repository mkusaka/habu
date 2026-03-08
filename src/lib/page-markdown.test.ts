import { fetchMock } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { fetchPageMarkdown, isUrlSafeToFetch } from "./page-markdown";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

describe("isUrlSafeToFetch", () => {
  it("rejects localhost URLs", () => {
    expect(isUrlSafeToFetch("http://localhost:3000")).toEqual({
      valid: false,
      error: "Private/localhost URLs are not allowed",
    });
  });

  it("accepts public https URLs", () => {
    expect(isUrlSafeToFetch("https://example.com/path")).toEqual({ valid: true });
  });
});

describe("fetchPageMarkdown", () => {
  it("returns an error when browser rendering is not configured", async () => {
    await expect(fetchPageMarkdown("https://example.com", {})).resolves.toEqual({
      markdown: "",
      error: "Browser Rendering is not configured",
    });
  });

  it("fetches markdown from Cloudflare Browser Rendering", async () => {
    fetchMock
      .get("https://api.cloudflare.com")
      .intercept({
        path: "/client/v4/accounts/account-id/browser-rendering/markdown",
        method: "POST",
      })
      .reply(
        200,
        JSON.stringify({
          success: true,
          result: "# Example\n\nBody text",
        }),
        { headers: { "content-type": "application/json; charset=utf-8" } },
      );

    const result = await fetchPageMarkdown("https://example.com", {
      cfAccountId: "account-id",
      cfApiToken: "api-token",
    });

    expect(result).toEqual({
      markdown: "# Example\n\nBody text",
      source: "cloudflare",
    });
  });
});
