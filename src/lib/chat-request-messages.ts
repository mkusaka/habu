import type { UIMessage } from "ai";

export interface ChatRequestMessagePayload {
  trigger?: "submit-message" | "regenerate-message";
  message?: UIMessage;
  messageId?: string;
}

export function applyChatRequestToMessages(
  previousMessages: UIMessage[],
  payload: ChatRequestMessagePayload,
): UIMessage[] {
  const trigger = payload.trigger ?? "submit-message";

  if (trigger === "submit-message") {
    if (!payload.message) {
      throw new Error("Message is required");
    }

    if (payload.messageId) {
      const messageIndex = previousMessages.findIndex(
        (message) => message.id === payload.messageId,
      );

      if (messageIndex === -1) {
        return [...previousMessages, payload.message];
      }

      if (previousMessages[messageIndex].role !== "user") {
        throw new Error(`message with id ${payload.messageId} is not a user message`);
      }

      const nextMessages = previousMessages.slice(0, messageIndex + 1);
      nextMessages[messageIndex] = {
        ...payload.message,
        id: payload.messageId,
        role: "user",
      };
      return nextMessages;
    }

    return [...previousMessages, payload.message];
  }

  const messageIndex =
    payload.messageId == null
      ? previousMessages.length - 1
      : previousMessages.findIndex((message) => message.id === payload.messageId);

  if (messageIndex === -1) {
    return previousMessages;
  }

  return previousMessages.slice(
    0,
    previousMessages[messageIndex].role === "assistant" ? messageIndex : messageIndex + 1,
  );
}
