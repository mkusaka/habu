import { fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  getRequestToken,
  getAuthorizeUrl,
  getAccessToken,
  fetchHatenaUserInfo,
  createSignedRequest,
} from "./hatena-oauth";

// Enable fetch mock
beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

const CONSUMER_KEY = "test-consumer-key";
const CONSUMER_SECRET = "test-consumer-secret";

describe("getAuthorizeUrl", () => {
  it("returns correct authorize URL with encoded token", () => {
    const token = "test-token-123";
    const url = getAuthorizeUrl(token);
    expect(url).toBe("https://www.hatena.ne.jp/oauth/authorize?oauth_token=test-token-123");
  });

  it("encodes special characters in token", () => {
    const token = "test+token/special=chars";
    const url = getAuthorizeUrl(token);
    expect(url).toBe(
      "https://www.hatena.ne.jp/oauth/authorize?oauth_token=test%2Btoken%2Fspecial%3Dchars",
    );
  });
});

describe("getRequestToken", () => {
  it("returns token and tokenSecret on success", async () => {
    fetchMock
      .get("https://www.hatena.com")
      .intercept({ path: "/oauth/initiate", method: "POST" })
      .reply(200, "oauth_token=request-token&oauth_token_secret=request-secret", {
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });

    const result = await getRequestToken(
      "http://localhost:3000/callback",
      CONSUMER_KEY,
      CONSUMER_SECRET,
    );

    expect(result.token).toBe("request-token");
    expect(result.tokenSecret).toBe("request-secret");
  });

  it("throws error on failed request", async () => {
    fetchMock
      .get("https://www.hatena.com")
      .intercept({ path: "/oauth/initiate", method: "POST" })
      .reply(401, "oauth_problem=signature_invalid");

    await expect(
      getRequestToken("http://localhost:3000/callback", CONSUMER_KEY, CONSUMER_SECRET),
    ).rejects.toThrow("Failed to get request token");
  });

  it("throws error when response is missing token", async () => {
    fetchMock
      .get("https://www.hatena.com")
      .intercept({ path: "/oauth/initiate", method: "POST" })
      .reply(200, "oauth_token=request-token", {
        // missing oauth_token_secret
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });

    await expect(
      getRequestToken("http://localhost:3000/callback", CONSUMER_KEY, CONSUMER_SECRET),
    ).rejects.toThrow("Invalid response from Hatena OAuth: missing token or secret");
  });
});

describe("getAccessToken", () => {
  it("returns accessToken and accessTokenSecret on success", async () => {
    fetchMock
      .get("https://www.hatena.com")
      .intercept({ path: "/oauth/token", method: "POST" })
      .reply(200, "oauth_token=access-token&oauth_token_secret=access-secret", {
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });

    const result = await getAccessToken(
      "request-token",
      "request-secret",
      "verifier-123",
      CONSUMER_KEY,
      CONSUMER_SECRET,
    );

    expect(result.accessToken).toBe("access-token");
    expect(result.accessTokenSecret).toBe("access-secret");
  });

  it("throws error on failed request", async () => {
    fetchMock
      .get("https://www.hatena.com")
      .intercept({ path: "/oauth/token", method: "POST" })
      .reply(401, "oauth_problem=token_rejected");

    await expect(
      getAccessToken(
        "request-token",
        "request-secret",
        "verifier-123",
        CONSUMER_KEY,
        CONSUMER_SECRET,
      ),
    ).rejects.toThrow("Failed to get access token");
  });

  it("throws error when response is missing access token", async () => {
    fetchMock
      .get("https://www.hatena.com")
      .intercept({ path: "/oauth/token", method: "POST" })
      .reply(200, "oauth_token_secret=access-secret", {
        // missing oauth_token
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });

    await expect(
      getAccessToken(
        "request-token",
        "request-secret",
        "verifier-123",
        CONSUMER_KEY,
        CONSUMER_SECRET,
      ),
    ).rejects.toThrow("Invalid response from Hatena OAuth: missing access token or secret");
  });
});

describe("fetchHatenaUserInfo", () => {
  it("returns hatenaId and displayName on success", async () => {
    fetchMock
      .get("https://n.hatena.com")
      .intercept({ path: "/applications/my.json" })
      .reply(
        200,
        { url_name: "testuser", display_name: "Test User" },
        { headers: { "content-type": "application/json" } },
      );

    const result = await fetchHatenaUserInfo(
      "access-token",
      "access-secret",
      CONSUMER_KEY,
      CONSUMER_SECRET,
    );

    expect(result.hatenaId).toBe("testuser");
    expect(result.displayName).toBe("Test User");
  });

  it("returns hatenaId without displayName if not provided", async () => {
    fetchMock
      .get("https://n.hatena.com")
      .intercept({ path: "/applications/my.json" })
      .reply(200, { url_name: "testuser" }, { headers: { "content-type": "application/json" } });

    const result = await fetchHatenaUserInfo(
      "access-token",
      "access-secret",
      CONSUMER_KEY,
      CONSUMER_SECRET,
    );

    expect(result.hatenaId).toBe("testuser");
    expect(result.displayName).toBeUndefined();
  });

  it("throws error on failed request", async () => {
    fetchMock
      .get("https://n.hatena.com")
      .intercept({ path: "/applications/my.json" })
      .reply(401, "Unauthorized");

    await expect(
      fetchHatenaUserInfo("access-token", "access-secret", CONSUMER_KEY, CONSUMER_SECRET),
    ).rejects.toThrow("Failed to fetch Hatena user info");
  });
});

describe("createSignedRequest", () => {
  it("returns headers with Authorization", () => {
    const headers = createSignedRequest(
      "https://bookmark.hatenaapis.com/rest/1/my/bookmark",
      "GET",
      "access-token",
      "access-secret",
      CONSUMER_KEY,
      CONSUMER_SECRET,
    );

    expect(headers).toHaveProperty("Authorization");
    expect(headers.Authorization).toMatch(/^OAuth /);
    expect(headers.Authorization).toContain("oauth_consumer_key");
    expect(headers.Authorization).toContain("oauth_signature");
    expect(headers.Authorization).toContain("oauth_token");
  });

  it("includes data in signature when provided", () => {
    const headers = createSignedRequest(
      "https://bookmark.hatenaapis.com/rest/1/my/bookmark",
      "POST",
      "access-token",
      "access-secret",
      CONSUMER_KEY,
      CONSUMER_SECRET,
      { url: "https://example.com", comment: "test comment" },
    );

    expect(headers).toHaveProperty("Authorization");
    expect(headers.Authorization).toMatch(/^OAuth /);
  });
});
