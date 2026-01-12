import type { McpScope } from "@/lib/auth";

// MCP session context passed to tools
export interface McpContext {
  userId: string;
  scopes: string[];
  hatenaToken: {
    accessToken: string;
    accessTokenSecret: string;
  } | null;
}

// Helper to check if a scope is granted
export function hasScope(context: McpContext, scope: McpScope): boolean {
  return context.scopes.includes(scope);
}

// Tool result types
export interface ToolSuccess<T> {
  success: true;
  data: T;
}

export interface ToolError {
  success: false;
  error: string;
}

export type ToolResult<T> = ToolSuccess<T> | ToolError;
