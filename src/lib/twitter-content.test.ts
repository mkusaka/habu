import { fetchMock } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { fetchTwitterMarkdown } from "./twitter-content";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
  (globalThis as unknown as { __XAI_API_KEY__?: string }).__XAI_API_KEY__ = "test-xai-key";
  (globalThis as unknown as { __XAI_BASE_URL__?: string }).__XAI_BASE_URL__ = "https://api.x.ai/v1";
  (globalThis as unknown as { __XAI_MODEL__?: string }).__XAI_MODEL__ = "grok-2-latest";
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
  (globalThis as unknown as { __X_BEARER_TOKEN__?: string }).__X_BEARER_TOKEN__ = undefined;
});

describe("fetchTwitterMarkdown", () => {
  it("prefers X API content when available", async () => {
    (globalThis as unknown as { __X_BEARER_TOKEN__?: string }).__X_BEARER_TOKEN__ = "test-x-bearer";

    fetchMock
      .get("https://api.x.com")
      .intercept({ path: /\/2\/tweets\/123\?/, method: "GET" })
      .reply(
        200,
        JSON.stringify({
          data: {
            id: "123",
            text: "standard tweet",
            created_at: "2026-02-10T19:52:55.000Z",
            author_id: "113419064",
          },
        }),
        { headers: { "content-type": "application/json; charset=utf-8" } },
      );

    const result = await fetchTwitterMarkdown("https://x.com/someone/status/123");
    expect(result?.source).toBe("x-api");
    expect(result?.markdown).toContain("standard tweet");
    expect(result?.markdown).toContain("https://x.com/someone/status/123");
  });

  it("uses X API article plain_text when present", async () => {
    (globalThis as unknown as { __X_BEARER_TOKEN__?: string }).__X_BEARER_TOKEN__ = "test-x-bearer";

    fetchMock
      .get("https://api.x.com")
      .intercept({ path: /\/2\/tweets\/124\?/, method: "GET" })
      .reply(
        200,
        JSON.stringify({
          data: {
            id: "124",
            text: "https://t.co/short",
            article: {
              plain_text: "article body",
            },
          },
        }),
        { headers: { "content-type": "application/json; charset=utf-8" } },
      );

    const result = await fetchTwitterMarkdown("https://x.com/someone/status/124");
    expect(result?.source).toBe("x-api");
    expect(result?.markdown).toContain("article body");
  });

  it("prefers Grok thread content when X API is not configured", async () => {
    fetchMock
      .get("https://api.x.ai")
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(
        200,
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  ok: true,
                  canonicalUrl: "https://x.com/someone/status/123",
                  thread: [
                    {
                      id: "123",
                      url: "https://x.com/someone/status/123",
                      authorName: "Someone",
                      authorHandle: "@someone",
                      createdAt: "2025-01-01T00:00:00Z",
                      text: "first tweet",
                    },
                    {
                      id: "124",
                      url: "https://x.com/someone/status/124",
                      authorName: "Someone",
                      authorHandle: "@someone",
                      createdAt: "2025-01-01T00:01:00Z",
                      text: "second tweet",
                    },
                  ],
                  relatedUrls: ["https://example.com/a", "https://example.com/a"],
                }),
              },
            },
          ],
        }),
        { headers: { "content-type": "application/json; charset=utf-8" } },
      );

    const result = await fetchTwitterMarkdown("https://x.com/someone/status/123");
    expect(result?.source).toBe("grok");
    expect(result?.markdown).toContain("first tweet");
    expect(result?.markdown).toContain("second tweet");
    expect(result?.markdown).toContain("Links:");
    expect(result?.markdown).toContain("https://example.com/a");
  });

  it("falls back to oEmbed when Grok cannot fetch", async () => {
    fetchMock
      .get("https://api.x.ai")
      .intercept({ path: "/v1/chat/completions", method: "POST" })
      .reply(
        200,
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ ok: false, reason: "not accessible" }),
              },
            },
          ],
        }),
        { headers: { "content-type": "application/json; charset=utf-8" } },
      );

    fetchMock
      .get("https://publish.twitter.com")
      .intercept({ path: /\/oembed/ })
      .reply(
        200,
        JSON.stringify({
          url: "https://twitter.com/someone/status/123",
          author_name: "Someone",
          author_url: "https://twitter.com/someone",
          provider_name: "X",
          html: '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Hello &amp; welcome</p>&mdash; Someone (@someone) <a href="https://twitter.com/someone/status/123">Date</a></blockquote>',
        }),
        { headers: { "content-type": "application/json; charset=utf-8" } },
      );

    const result = await fetchTwitterMarkdown("https://x.com/someone/status/123");
    expect(result?.source).toBe("oembed");
    expect(result?.markdown).toContain("Hello & welcome");
  });
});
