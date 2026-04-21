import { describe, expect, it } from "vitest";
import { buildChatSystemPrompt } from "./chat-context";

describe("buildChatSystemPrompt", () => {
  it("tells the model not to trust Hatena bookmark search too much", () => {
    const prompt = buildChatSystemPrompt();

    expect(prompt).toContain("do not over-trust Hatena Bookmark search recall");
    expect(prompt).toContain("multiple related keyword passes");
    expect(prompt).toContain("synonyms, abbreviations, English/Japanese variants");
    expect(prompt).toContain("broad multi-pass bookmark search");
    expect(prompt).toContain("format them as Markdown links");
    expect(prompt).toContain("Do not wrap URLs in backticks");
  });
});
