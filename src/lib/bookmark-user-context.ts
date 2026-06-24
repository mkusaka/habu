import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";

export interface BookmarkUserContext {
  userId: string;
  hatenaId: string | null;
  hatenaToken: {
    accessToken: string;
    accessTokenSecret: string;
  } | null;
}

export async function buildBookmarkUserContextForUser(
  userId: string,
  dbBinding: D1Database,
): Promise<BookmarkUserContext | null> {
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
    hatenaToken: user.hatenaToken
      ? {
          accessToken: user.hatenaToken.accessToken,
          accessTokenSecret: user.hatenaToken.accessTokenSecret,
        }
      : null,
  };
}
