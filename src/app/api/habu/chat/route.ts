import { NextRequest } from "next/server";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { buildChatSystemPrompt, type ChatContext, type PageMetadata } from "@/lib/chat-context";

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

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
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

    const chatContext: ChatContext = {
      url: context.url,
      markdown: context.markdown,
      metadata: context.metadata,
      existingComment: context.existingComment,
      existingTags: context.existingTags,
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
