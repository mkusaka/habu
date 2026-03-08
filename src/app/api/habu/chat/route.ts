import { NextRequest } from "next/server";
import {
  streamText,
  convertToModelMessages,
  tool,
  stepCountIs,
  type ToolSet,
  type UIMessage,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { buildMcpContextForUser } from "@/lib/bookmark-user-context";
import { applyChatRequestToMessages } from "@/lib/chat-request-messages";
import { getChatThreadForHatenaAccount, saveChatThreadForHatenaAccount } from "@/lib/chat-history";
import {
  buildChatSystemPrompt,
  buildChatUserContext,
  type ChatContext,
  type PageMetadata,
} from "@/lib/chat-context";
import { fetchPageMarkdownSchema, fetchPageMarkdownTool } from "@/mcp/tools/fetch-page-markdown";
import { getBookmark, getBookmarkSchema } from "@/mcp/tools/get-bookmark";
import { listBookmarks, listBookmarksSchema } from "@/mcp/tools/list-bookmarks";
import { searchBookmarks, searchBookmarksSchema } from "@/mcp/tools/search-bookmarks";
import type { ToolResult } from "@/mcp/types";

interface ChatRequestBody {
  id?: string;
  trigger?: "submit-message" | "regenerate-message";
  message?: UIMessage;
  messageId?: string;
  context: {
    url?: string;
    query?: string;
    markdown?: string;
    metadata?: PageMetadata;
    existingComment?: string;
    existingTags?: string[];
  };
}

function toToolOutput<T>(result: ToolResult<T>): T | { error: string } {
  return result.success ? result.data : { error: result.error };
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

    const mcpContext = await buildMcpContextForUser(session.user.id, env.DB);
    if (!mcpContext) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!mcpContext.hatenaId) {
      return new Response(JSON.stringify({ error: "Hatena not connected" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const hatenaId = mcpContext.hatenaId;

    const body = (await request.json()) as ChatRequestBody;
    const { context } = body;

    if (!body.id) {
      return new Response(JSON.stringify({ error: "Session ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const threadId = body.id;
    if ((body.trigger ?? "submit-message") === "submit-message" && !body.message) {
      return new Response(JSON.stringify({ error: "Latest message is required" }), {
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
      query: context.query,
      markdown: context.markdown,
      metadata: context.metadata,
      existingComment: context.existingComment,
      existingTags: context.existingTags,
    };

    // Build system prompt (AI instructions only, no user content)
    const systemPrompt = buildChatSystemPrompt();

    // Build user context message (page content as data)
    const userContextMessage = buildChatUserContext(chatContext);

    // Create tools
    const toolEnv = {
      HATENA_CONSUMER_KEY: env.HATENA_CONSUMER_KEY,
      HATENA_CONSUMER_SECRET: env.HATENA_CONSUMER_SECRET,
      BROWSER_RENDERING_ACCOUNT_ID: env.BROWSER_RENDERING_ACCOUNT_ID,
      BROWSER_RENDERING_API_TOKEN: env.BROWSER_RENDERING_API_TOKEN,
    };

    const tools: ToolSet = {
      web_search: openai.tools.webSearch({}),
      fetch_markdown: tool({
        description:
          "Fetch the markdown content of a public web page by URL. Use this when you need the actual page content.",
        inputSchema: fetchPageMarkdownSchema,
        execute: async (input) =>
          toToolOutput(await fetchPageMarkdownTool(input, mcpContext, toolEnv)),
      }),
      list_bookmarks: tool({
        description:
          "List your Hatena bookmarks in reverse chronological order. Use this for browsing recent bookmarks or paginating through them.",
        inputSchema: listBookmarksSchema,
        execute: async (input) => toToolOutput(await listBookmarks(input, mcpContext, toolEnv)),
      }),
      search_bookmarks: tool({
        description:
          "Search your Hatena bookmarks by keyword across title, URL, comment text, and tags. Use this first when the user asks about previously saved bookmarks.",
        inputSchema: searchBookmarksSchema,
        execute: async (input) => toToolOutput(await searchBookmarks(input, mcpContext, toolEnv)),
      }),
      get_bookmark: tool({
        description:
          "Get the exact Hatena bookmark for a specific URL. Use this when the user asks whether a URL is already bookmarked or wants its saved comment/tags.",
        inputSchema: getBookmarkSchema,
        execute: async (input) => toToolOutput(await getBookmark(input, mcpContext, toolEnv)),
      }),
    };

    const previousThread = await getChatThreadForHatenaAccount(hatenaId, threadId, env.DB);
    const previousMessages = previousThread?.messages ?? [];
    const requestMessages = applyChatRequestToMessages(previousMessages, body);

    const contextMessages: UIMessage[] =
      requestMessages.length === 1
        ? [
            {
              id: `context-${threadId}`,
              role: "user",
              parts: [{ type: "text", text: userContextMessage }],
            },
            {
              id: `context-ack-${threadId}`,
              role: "assistant",
              parts: [
                { type: "text", text: "I understand the search context. How can I help you?" },
              ],
            },
          ]
        : [];

    const result = streamText({
      model: openai("gpt-5.4"),
      system: systemPrompt,
      messages: await convertToModelMessages([...contextMessages, ...requestMessages]),
      tools,
      maxOutputTokens: 3072,
      stopWhen: stepCountIs(8),
    });

    // Use toUIMessageStreamResponse to include tool call information in the stream
    return result.toUIMessageStreamResponse({
      originalMessages: requestMessages,
      onFinish: async ({ messages: finalMessages, isAborted }) => {
        if (isAborted) {
          return;
        }

        await saveChatThreadForHatenaAccount({
          threadId,
          userId: session.user.id,
          hatenaId,
          query: context.query,
          url: context.url,
          title: context.metadata?.title || context.query || context.url || "Search Session",
          messages: finalMessages,
          dbBinding: env.DB,
        });
      },
    });
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
