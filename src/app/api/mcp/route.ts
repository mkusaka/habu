import { NextRequest, NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createMcpServer } from "@/mcp/server";
import type { McpContext } from "@/mcp/types";

// CORS headers required for browser-based MCP clients (e.g., MCP Inspector)
// MCP_ALLOWED_ORIGINS env var: comma-separated list of allowed origins
// Default: http://localhost:6274 (MCP Inspector default)
function getCorsHeaders(request?: NextRequest) {
  const allowedOrigins = (process.env.MCP_ALLOWED_ORIGINS || "http://localhost:6274")
    .split(",")
    .map((o) => o.trim());

  const origin = request?.headers.get("origin") || "";
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-protocol-version",
    "Access-Control-Expose-Headers": "mcp-session-id",
  };
}

// Helper to verify JWT and extract user info
async function verifyMcpAuth(request: NextRequest, env: CloudflareEnv): Promise<McpContext | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.replace("Bearer ", "");
  const auth = createAuth(env.DB);

  try {
    // Use Better Auth's JWT verification
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return null;
    }

    // Get user with hatenaToken relation
    const db = getDb(env.DB);
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      with: { hatenaToken: true },
    });

    if (!user) {
      return null;
    }

    // Extract scopes from JWT (stored in token claims)
    // For now, use the session to get basic info
    // TODO: Extract scopes from JWT claims when Better Auth OAuth Provider supports it
    const scopes = ["bookmark:read", "bookmark:write", "bookmark:delete", "bookmark:suggest"];

    return {
      userId: user.id,
      scopes,
      hatenaToken: user.hatenaToken
        ? {
            accessToken: user.hatenaToken.accessToken,
            accessTokenSecret: user.hatenaToken.accessTokenSecret,
          }
        : null,
    };
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

// Convert Next.js Request to node-style request for MCP SDK
async function handleMcpRequest(
  request: NextRequest,
  context: McpContext,
  env: CloudflareEnv,
): Promise<Response> {
  // Create MCP server with user context
  const server = createMcpServer(context, {
    HATENA_CONSUMER_KEY: env.HATENA_CONSUMER_KEY,
    HATENA_CONSUMER_SECRET: env.HATENA_CONSUMER_SECRET,
  });

  // Create transport for this request (stateless mode)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless - no session tracking
  });

  // Connect server to transport
  await server.connect(transport);

  try {
    // Parse the request body
    const body = await request.json();

    // Create a mock response object to capture the MCP response
    let responseBody = "";
    let responseHeaders: Record<string, string> = {};
    let responseStatus = 200;

    const mockRes = {
      setHeader: (name: string, value: string) => {
        responseHeaders[name] = value;
      },
      getHeader: (name: string) => responseHeaders[name],
      writeHead: (status: number, headers?: Record<string, string>) => {
        responseStatus = status;
        if (headers) {
          responseHeaders = { ...responseHeaders, ...headers };
        }
      },
      write: (chunk: string) => {
        responseBody += chunk;
      },
      end: (chunk?: string) => {
        if (chunk) {
          responseBody += chunk;
        }
      },
      on: () => {},
      headersSent: false,
    };

    // Create a mock request object
    const mockReq = {
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
    };

    // Handle the request through the transport
    await transport.handleRequest(mockReq as any, mockRes as any, body);

    // Return the response with CORS headers
    return new Response(responseBody, {
      status: responseStatus,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders(request),
        ...responseHeaders,
      },
    });
  } finally {
    // Clean up
    await transport.close();
    await server.close();
  }
}

// POST - Main MCP endpoint for client requests
export async function POST(request: NextRequest) {
  const { env } = getCloudflareContext();

  // Verify authentication
  const context = await verifyMcpAuth(request, env);
  if (!context) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unauthorized",
        },
        id: null,
      },
      {
        status: 401,
        headers: {
          ...getCorsHeaders(request),
          "WWW-Authenticate": 'Bearer realm="habu MCP"',
        },
      },
    );
  }

  try {
    return await handleMcpRequest(request, context, env);
  } catch (error) {
    console.error("MCP request error:", error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}

// GET - Return 405 Method Not Allowed (SSE not supported in stateless mode)
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32601,
        message: "Method not allowed. This endpoint only supports POST requests.",
      },
      id: null,
    },
    { status: 405, headers: getCorsHeaders(request) },
  );
}

// DELETE - Return 405 Method Not Allowed (no session management in stateless mode)
export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32601,
        message: "Method not allowed. Sessions are not supported in stateless mode.",
      },
      id: null,
    },
    { status: 405, headers: getCorsHeaders(request) },
  );
}

// OPTIONS - CORS preflight handler
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}
