import { NextRequest } from "next/server";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { buildChatSystemPrompt, type ChatContext, type PageMetadata } from "@/lib/chat-context";

// Maximum number of messages to prevent excessive token usage
const MAX_MESSAGES = 50;
// Maximum total character length for all messages
const MAX_TOTAL_LENGTH = 100000;
// Maximum length for context fields
const MAX_MARKDOWN_LENGTH = 50000;
const MAX_COMMENT_LENGTH = 500;

interface ChatRequestBody {
  messages: UIMessage[];
  context: {
    url: string;
    markdown?: string;
    metadata?: PageMetadata;
    existingComment?: string;
    existingTags?: string[];
  };
  mcpServers?: Array<{
    url: string;
    name?: string;
  }>;
}

// Supported part types for chat messages
const ALLOWED_PART_TYPES = new Set(["text"]);

function validateMessages(messages: unknown): messages is UIMessage[] {
  if (!Array.isArray(messages)) return false;
  if (messages.length === 0) return false;
  if (messages.length > MAX_MESSAGES) return false;

  let totalLength = 0;
  for (const msg of messages) {
    if (typeof msg !== "object" || msg === null) return false;
    // Validate role and id are strings
    if (!("role" in msg) || typeof msg.role !== "string") return false;
    if (!("id" in msg) || typeof msg.id !== "string") return false;
    // Only allow user and assistant roles (not system)
    if (msg.role !== "user" && msg.role !== "assistant") return false;

    // UIMessage requires parts array
    if (!("parts" in msg) || !Array.isArray(msg.parts)) return false;

    for (const part of msg.parts) {
      // Validate each part is a valid object with type
      if (typeof part !== "object" || part === null) return false;
      if (!("type" in part) || typeof part.type !== "string") return false;

      // Only allow supported part types
      if (!ALLOWED_PART_TYPES.has(part.type)) return false;

      if (part.type === "text") {
        // text parts must have a text string
        if (!("text" in part) || typeof part.text !== "string") return false;
        totalLength += part.text.length;
      }
    }

    if (totalLength > MAX_TOTAL_LENGTH) return false;
  }

  return true;
}

function truncateString(str: string | undefined, maxLength: number): string | undefined {
  if (!str) return str;
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "... (truncated)";
}

export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const auth = createAuth(env.DB);

    // Verify session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await request.json()) as ChatRequestBody;
    const { messages, context } = body;

    if (!validateMessages(messages)) {
      return new Response(JSON.stringify({ error: "Invalid or too many messages" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!context?.url) {
      return new Response(JSON.stringify({ error: "Context URL is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const openaiApiKey = env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const openai = createOpenAI({
      apiKey: openaiApiKey,
    });

    // Build chat context with size limits applied
    const chatContext: ChatContext = {
      url: context.url,
      markdown: truncateString(context.markdown, MAX_MARKDOWN_LENGTH),
      metadata: context.metadata,
      existingComment: truncateString(context.existingComment, MAX_COMMENT_LENGTH),
      existingTags: context.existingTags?.slice(0, 50), // Max 50 tags
    };

    const systemPrompt = buildChatSystemPrompt(chatContext);

    // Convert UIMessage format to ModelMessage format for streamText
    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: 2048,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
