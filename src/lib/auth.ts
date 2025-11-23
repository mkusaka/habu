import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";
import type { HabuUser } from "@/types/habu";

export const auth = betterAuth({
  // Stateless mode - no database required
  // Session and user info are stored in signed tokens
  secret: process.env.BETTER_AUTH_SECRET || "change-this-secret-in-production",

  // Configure session for stateless mode
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      strategy: "jwe", // Use JWE for encrypted session cookies
      refreshCache: true,
    },
  },

  // Enable anonymous plugin for guest users
  plugins: [
    anonymous(),
  ],

  // Account settings for stateless mode
  account: {
    accountLinking: {
      enabled: true,
    },
  },

  // Trust the host header for Cloudflare Workers
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: false,
    },
  },
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

// Helper functions for OAuth state management
// Note: OAuth state is managed via encrypted cookies (CryptoJS.AES) in oauth routes
// This approach is simpler and equally secure for stateless OAuth flow
