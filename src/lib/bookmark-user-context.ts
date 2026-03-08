import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { MCP_SCOPES } from "@/lib/auth";
import type { McpContext } from "@/mcp/types";

export async function buildMcpContextForUser(
  userId: string,
  dbBinding: D1Database,
): Promise<McpContext | null> {
  const db = getDb(dbBinding);
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: { hatenaToken: true },
  });

  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    hatenaId: user.hatenaId ?? null,
    scopes: [...MCP_SCOPES],
    hatenaToken: user.hatenaToken
      ? {
          accessToken: user.hatenaToken.accessToken,
          accessTokenSecret: user.hatenaToken.accessTokenSecret,
        }
      : null,
  };
}
