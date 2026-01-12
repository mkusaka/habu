import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { createAuth } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { env } = getCloudflareContext();
  const auth = createAuth(env.DB);
  return oauthProviderOpenIdConfigMetadata(auth)(request);
}
