import { NextRequest } from "next/server";
import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { buildChatSystemPrompt, type ChatContext, type PageMetadata } from "@/lib/chat-context";
import { z } from "zod";

// Validate URL is safe to fetch (http/https only, no private IPs/localhost)
function isUrlSafeToFetch(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { valid: false, error: "Only http/https URLs are allowed" };
    }

    // Block localhost and common private hostnames
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return { valid: false, error: "Private/localhost URLs are not allowed" };
    }

    // Block IPv6 localhost and private ranges
    // URL.hostname returns IPv6 without brackets (e.g., "::1" not "[::1]")
    if (
      hostname === "::1" ||
      hostname.startsWith("fc") || // fc00::/7 (Unique Local Address)
      hostname.startsWith("fd") || // fc00::/7 (Unique Local Address)
      hostname.startsWith("fe80") || // fe80::/10 (Link-local)
      hostname.startsWith("::ffff:127.") || // IPv4-mapped localhost
      hostname.startsWith("::ffff:10.") || // IPv4-mapped 10.x.x.x
      hostname.startsWith("::ffff:192.168.") || // IPv4-mapped 192.168.x.x
      hostname.startsWith("::ffff:172.") // IPv4-mapped 172.x.x.x (needs more specific check below)
    ) {
      return { valid: false, error: "Private/localhost IPv6 addresses are not allowed" };
    }

    // Block private IP ranges (RFC1918)
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number);
      // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
      if (
        a === 10 ||
        a === 127 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 169 && b === 254)
      ) {
        return { valid: false, error: "Private IP addresses are not allowed" };
      }
    }

    // URL length limit
    if (urlString.length > 2048) {
      return { valid: false, error: "URL is too long" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

interface ChatRequestBody {
  messages: UIMessage[];
  context: {
    url: string;
    markdown?: string;
    metadata?: PageMetadata;
    existingComment?: string;
    existingTags?: string[];
  };
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

    // Create tools
    const cfAccountId = env.BROWSER_RENDERING_ACCOUNT_ID;
    const cfApiToken = env.BROWSER_RENDERING_API_TOKEN;

    const tools = {
      // Web search tool (OpenAI built-in) - always enabled
      web_search: openai.tools.webSearch({}),
      // Markdown fetch tool - always enabled
      fetch_markdown: tool({
        description:
          "Fetch the markdown content of a web page. Use this when you need to read the actual content of a URL that was mentioned or when the user asks about a specific page.",
        inputSchema: z.object({
          url: z.string().url().describe("The URL of the web page to fetch"),
        }),
        execute: async ({ url }) => {
          // Validate URL before fetching
          const urlCheck = isUrlSafeToFetch(url);
          if (!urlCheck.valid) {
            return { error: urlCheck.error };
          }

          // Check if Browser Rendering is configured
          if (!cfAccountId || !cfApiToken) {
            return { error: "Browser Rendering is not configured" };
          }

          try {
            const response = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/browser-rendering/markdown`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${cfApiToken}`,
                },
                body: JSON.stringify({ url }),
              },
            );

            if (!response.ok) {
              return { error: `Failed to fetch: ${response.status}` };
            }

            const data = (await response.json()) as {
              success: boolean;
              result?: string;
              errors?: unknown[];
            };

            if (data.success && data.result) {
              // Truncate to avoid excessive token usage
              const markdown = data.result.slice(0, 50000);
              return { markdown };
            }

            return { error: "Failed to extract markdown from page" };
          } catch (error) {
            return { error: error instanceof Error ? error.message : "Unknown error" };
          }
        },
      }),
    };

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages: modelMessages,
      tools,
      maxOutputTokens: 2048,
      stopWhen: stepCountIs(5), // Limit tool call loops to prevent abuse
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
