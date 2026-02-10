import { fetchMock } from "cloudflare:test";
import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { fetchTwitterOEmbed, formatTwitterMarkdown, isTwitterStatusUrl } from "./twitter-oembed";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

describe("isTwitterStatusUrl", () => {
  it("matches x.com and twitter.com status URLs", () => {
    expect(isTwitterStatusUrl("https://x.com/i/status/123")).toBe(true);
    expect(isTwitterStatusUrl("https://twitter.com/user/status/123?s=20")).toBe(true);
    expect(isTwitterStatusUrl("https://mobile.x.com/user/status/123")).toBe(true);
    expect(isTwitterStatusUrl("https://mobile.twitter.com/user/status/123")).toBe(true);
    expect(isTwitterStatusUrl("https://x.com/home")).toBe(false);
  });
});

describe("fetchTwitterOEmbed", () => {
  it("parses tweet text and author info from oEmbed", async () => {
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

    const oembed = await fetchTwitterOEmbed("https://x.com/someone/status/123");
    expect(oembed).not.toBeNull();
    expect(oembed?.text).toBe("Hello & welcome");
    expect(oembed?.authorName).toBe("Someone");
    expect(oembed?.authorHandle).toBe("@someone");
    expect(oembed?.canonicalUrl).toBe("https://twitter.com/someone/status/123");

    const md = formatTwitterMarkdown(oembed!);
    expect(md).toContain("Hello & welcome");
    expect(md).toContain("Someone (@someone)");
    expect(md).toContain("https://twitter.com/someone/status/123");
  });
});
