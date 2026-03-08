import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { applyChatRequestToMessages } from "./chat-request-messages";

const userMessage = (id: string, text: string): UIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});

const assistantMessage = (id: string, text: string): UIMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text }],
});

describe("applyChatRequestToMessages", () => {
  it("appends the latest user message on submit", () => {
    const previous = [userMessage("u1", "hello"), assistantMessage("a1", "hi")];
    const next = applyChatRequestToMessages(previous, {
      trigger: "submit-message",
      message: userMessage("u2", "find recent bookmarks"),
    });

    expect(next).toEqual([...previous, userMessage("u2", "find recent bookmarks")]);
  });

  it("replaces an edited user message and truncates following messages", () => {
    const next = applyChatRequestToMessages(
      [
        userMessage("u1", "hello"),
        assistantMessage("a1", "hi"),
        userMessage("u2", "old query"),
        assistantMessage("a2", "old result"),
      ],
      {
        trigger: "submit-message",
        messageId: "u2",
        message: userMessage("draft", "new query"),
      },
    );

    expect(next).toEqual([
      userMessage("u1", "hello"),
      assistantMessage("a1", "hi"),
      userMessage("u2", "new query"),
    ]);
  });

  it("truncates to the assistant boundary on regenerate", () => {
    const next = applyChatRequestToMessages(
      [
        userMessage("u1", "hello"),
        assistantMessage("a1", "hi"),
        userMessage("u2", "query"),
        assistantMessage("a2", "answer"),
      ],
      {
        trigger: "regenerate-message",
        messageId: "a2",
      },
    );

    expect(next).toEqual([
      userMessage("u1", "hello"),
      assistantMessage("a1", "hi"),
      userMessage("u2", "query"),
    ]);
  });
});
