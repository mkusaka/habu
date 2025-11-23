import { betterAuth } from "better-auth";
import type { HabuUser } from "@/types/habu";

export const auth = betterAuth({
  // Stateless mode - no database required
  // Session and user info are stored in signed tokens
  secret: process.env.BETTER_AUTH_SECRET || "change-this-secret-in-production",

  // Configure session
  session: {
    // Use JWT for stateless sessions
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  },

  // Email/password provider (can add more later)
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Simplified for MVP
  },

  // Trust the host header for Cloudflare Workers
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: false,
    },
  },

  // We'll extend the user object to include Hatena tokens
  // This is done by adding custom fields in the session payload
});

// Type-safe auth client
export type Auth = typeof auth;

// Helper to get session with Hatena tokens
export async function getHabuSession(
  request: Request
): Promise<{ user: HabuUser } | null> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return null;
  }

  return {
    user: session.user as HabuUser,
  };
}
