import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";

interface HatenaRouteContext {
  userId: string;
  hatenaId: string;
  accessToken: string;
  accessTokenSecret: string;
  consumerKey: string;
  consumerSecret: string;
  scopes: string[];
}

type HatenaRouteAuthResult =
  | {
      ok: true;
      context: HatenaRouteContext;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function getHatenaRouteContext(headers: Headers): Promise<HatenaRouteAuthResult> {
  const { env } = getCloudflareContext();
  const auth = createAuth(env.DB);

  const session = await auth.api.getSession({
    headers,
  });

  if (!session?.user) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }

  const db = getDb(env.DB);
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    with: { hatenaToken: true },
  });

  if (!user?.hatenaToken) {
    return { ok: false, status: 400, error: "Hatena not connected" };
  }

  const consumerKey = env.HATENA_CONSUMER_KEY;
  const consumerSecret = env.HATENA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    return { ok: false, status: 500, error: "Server configuration error" };
  }

  return {
    ok: true,
    context: {
      userId: session.user.id,
      hatenaId: user.hatenaId || "",
      accessToken: user.hatenaToken.accessToken,
      accessTokenSecret: user.hatenaToken.accessTokenSecret,
      consumerKey,
      consumerSecret,
      scopes: user.hatenaToken.scope
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean),
    },
  };
}
