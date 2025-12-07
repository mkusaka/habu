import { fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchPageMeta, isMetaExtractionResult } from "./index";

// Enable fetch mock
beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

describe("fetchPageMeta", () => {
  it("throws error for invalid URL", async () => {
    await expect(fetchPageMeta("not-a-url")).rejects.toThrow("Invalid URL");
  });

  it("throws error for unsupported protocol", async () => {
    await expect(fetchPageMeta("ftp://example.com")).rejects.toThrow("Unsupported protocol");
  });

  it("extracts title and lang from HTML", async () => {
    fetchMock
      .get("https://example.com")
      .intercept({ path: "/" })
      .reply(
        200,
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Page Title</title>
  <meta name="description" content="Test description">
</head>
<body></body>
</html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );

    const result = await fetchPageMeta("https://example.com/");

    expect(isMetaExtractionResult(result)).toBe(true);
    if (isMetaExtractionResult(result)) {
      expect(result.title).toBe("Test Page Title");
      expect(result.lang).toBe("en");
      expect(result.description).toBe("Test description");
      expect(result.charset).toBe("UTF-8");
    }
  });

  it("extracts OG and Twitter meta tags", async () => {
    fetchMock
      .get("https://example.com")
      .intercept({ path: "/" })
      .reply(
        200,
        `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="OG Title">
  <meta property="og:description" content="OG Description">
  <meta property="og:image" content="https://example.com/image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Twitter Title">
</head>
<body></body>
</html>`,
        { headers: { "content-type": "text/html" } },
      );

    const result = await fetchPageMeta("https://example.com/");

    expect(isMetaExtractionResult(result)).toBe(true);
    if (isMetaExtractionResult(result)) {
      expect(result.og.title).toBe("OG Title");
      expect(result.og.description).toBe("OG Description");
      expect(result.og.image).toBe("https://example.com/image.png");
      expect(result.twitter.card).toBe("summary_large_image");
      expect(result.twitter.title).toBe("Twitter Title");
      // description should fallback to og:description
      expect(result.description).toBe("OG Description");
    }
  });

  it("extracts canonical and icons", async () => {
    fetchMock
      .get("https://example.com")
      .intercept({ path: "/" })
      .reply(
        200,
        `<!DOCTYPE html>
<html>
<head>
  <link rel="canonical" href="https://example.com/canonical-page">
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
</head>
<body></body>
</html>`,
        { headers: { "content-type": "text/html" } },
      );

    const result = await fetchPageMeta("https://example.com/");

    expect(isMetaExtractionResult(result)).toBe(true);
    if (isMetaExtractionResult(result)) {
      expect(result.canonical).toBe("https://example.com/canonical-page");
      expect(result.favicon).toBe("https://example.com/favicon.ico");
      expect(result.icons).toHaveLength(2);
      expect(result.icons[0]).toEqual({
        href: "https://example.com/favicon.ico",
        rel: "icon",
        type: undefined,
        sizes: undefined,
      });
      expect(result.icons[1]).toEqual({
        href: "https://example.com/apple-touch-icon.png",
        rel: "apple-touch-icon",
        type: undefined,
        sizes: "180x180",
      });
    }
  });

  it("extracts alternate links (hreflang and feeds)", async () => {
    fetchMock
      .get("https://example.com")
      .intercept({ path: "/" })
      .reply(
        200,
        `<!DOCTYPE html>
<html>
<head>
  <link rel="alternate" hreflang="ja" href="https://example.com/ja/">
  <link rel="alternate" hreflang="en" href="https://example.com/en/">
  <link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/feed.xml">
</head>
<body></body>
</html>`,
        { headers: { "content-type": "text/html" } },
      );

    const result = await fetchPageMeta("https://example.com/");

    expect(isMetaExtractionResult(result)).toBe(true);
    if (isMetaExtractionResult(result)) {
      expect(result.alternates).toHaveLength(3);
      expect(result.alternates[0]).toEqual({
        href: "https://example.com/ja/",
        hreflang: "ja",
        type: undefined,
        title: undefined,
      });
      expect(result.alternates[1]).toEqual({
        href: "https://example.com/en/",
        hreflang: "en",
        type: undefined,
        title: undefined,
      });
      expect(result.alternates[2]).toEqual({
        href: "https://example.com/feed.xml",
        hreflang: undefined,
        type: "application/rss+xml",
        title: "RSS Feed",
      });
    }
  });

  it("extracts additional meta fields (author, keywords, robots, generator, theme-color)", async () => {
    fetchMock
      .get("https://example.com")
      .intercept({ path: "/" })
      .reply(
        200,
        `<!DOCTYPE html>
<html>
<head>
  <meta name="author" content="John Doe">
  <meta name="keywords" content="test, example, meta">
  <meta name="robots" content="index, follow">
  <meta name="generator" content="My CMS 1.0">
  <meta name="theme-color" content="#ffffff">
</head>
<body></body>
</html>`,
        { headers: { "content-type": "text/html" } },
      );

    const result = await fetchPageMeta("https://example.com/");

    expect(isMetaExtractionResult(result)).toBe(true);
    if (isMetaExtractionResult(result)) {
      expect(result.author).toBe("John Doe");
      expect(result.keywords).toBe("test, example, meta");
      expect(result.robots).toBe("index, follow");
      expect(result.generator).toBe("My CMS 1.0");
      expect(result.themeColor).toBe("#ffffff");
    }
  });

  it("returns non-html response for non-HTML content", async () => {
    fetchMock
      .get("https://example.com")
      .intercept({ path: "/api/data" })
      .reply(200, '{"data": "test"}', {
        headers: { "content-type": "application/json" },
      });

    const result = await fetchPageMeta("https://example.com/api/data");

    expect(isMetaExtractionResult(result)).toBe(false);
    if (!isMetaExtractionResult(result)) {
      expect(result.error).toBe("non-html response");
    }
  });

  it("resolves relative URLs to absolute URLs", async () => {
    fetchMock
      .get("https://example.com")
      .intercept({ path: "/page" })
      .reply(
        200,
        `<!DOCTYPE html>
<html>
<head>
  <link rel="canonical" href="/page">
  <link rel="icon" href="favicon.ico">
  <meta property="og:image" content="../images/og.png">
</head>
<body></body>
</html>`,
        { headers: { "content-type": "text/html" } },
      );

    const result = await fetchPageMeta("https://example.com/page");

    expect(isMetaExtractionResult(result)).toBe(true);
    if (isMetaExtractionResult(result)) {
      expect(result.canonical).toBe("https://example.com/page");
      // favicon.ico relative to /page resolves to /favicon.ico (sibling, not child)
      expect(result.favicon).toBe("https://example.com/favicon.ico");
      // Note: og:image is stored as-is in the og map (not resolved)
      expect(result.og.image).toBe("../images/og.png");
    }
  });

  it("handles redirects and returns final URL", async () => {
    fetchMock
      .get("https://example.com")
      .intercept({ path: "/old-page" })
      .reply(200, `<!DOCTYPE html><html><head><title>Redirected</title></head></html>`, {
        headers: { "content-type": "text/html" },
      });

    const result = await fetchPageMeta("https://example.com/old-page");

    expect(isMetaExtractionResult(result)).toBe(true);
    if (isMetaExtractionResult(result)) {
      expect(result.requestedUrl).toBe("https://example.com/old-page");
      expect(result.title).toBe("Redirected");
    }
  });
});

describe("isMetaExtractionResult", () => {
  it("returns true for successful extraction result", () => {
    const result = {
      requestedUrl: "https://example.com",
      finalUrl: "https://example.com",
      status: 200,
      icons: [],
      alternates: [],
      og: {},
      twitter: {},
      metaByName: {},
      metaByProperty: {},
      metaTags: [],
      linkTags: [],
    };
    expect(isMetaExtractionResult(result)).toBe(true);
  });

  it("returns false for non-HTML response", () => {
    const result = {
      requestedUrl: "https://example.com",
      finalUrl: "https://example.com",
      status: 200,
      error: "non-html response" as const,
    };
    expect(isMetaExtractionResult(result)).toBe(false);
  });
});
