import { describe, expect, it } from "vitest";
import { validateSameOrigin } from "./same-origin";

describe("validateSameOrigin", () => {
  it("accepts requests from the same origin", () => {
    const request = new Request("https://habu.example/api/habu/tag-cleanup", {
      headers: {
        origin: "https://habu.example",
      },
    });

    expect(validateSameOrigin(request)).toBeNull();
  });

  it("rejects mismatched origin headers", () => {
    const request = new Request("https://habu.example/api/habu/tag-cleanup", {
      headers: {
        origin: "https://evil.example",
      },
    });

    expect(validateSameOrigin(request)).toBe("Invalid origin");
  });

  it("falls back to referer when origin is missing", () => {
    const request = new Request("https://habu.example/api/habu/tag-cleanup", {
      headers: {
        referer: "https://habu.example/settings",
      },
    });

    expect(validateSameOrigin(request)).toBeNull();
  });

  it("rejects mismatched referer when origin is missing", () => {
    const request = new Request("https://habu.example/api/habu/tag-cleanup", {
      headers: {
        referer: "https://evil.example/settings",
      },
    });

    expect(validateSameOrigin(request)).toBe("Invalid referer");
  });
});
