import { NextResponse } from "next/server";

// OAuth 2.0 Protected Resource Metadata (RFC 9728)
// https://modelcontextprotocol.io/specification/draft/basic/authorization
export async function GET() {
  const baseUrl = process.env.BETTER_AUTH_URL || "https://habu.example.com";

  const metadata = {
    resource: `${baseUrl}/api/mcp`,
    authorization_servers: [`${baseUrl}`],
    bearer_methods_supported: ["header"],
    scopes_supported: ["bookmark:read", "bookmark:write", "bookmark:delete", "bookmark:suggest"],
  };

  return NextResponse.json(metadata, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
