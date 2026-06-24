import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

// Create auth instance with database
// For Cloudflare Workers, this should be called with the D1 binding from env
export function createAuth(db: D1Database) {
  return betterAuth({
    database: drizzleAdapter(getDb(db), {
      provider: "sqlite",
      schema: {
        // Map plural table exports to Better Auth's expected singular model names
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),

    secret: process.env.BETTER_AUTH_SECRET || "change-this-secret-in-production",

    // Configure session
    session: {
      storeSessionInDatabase: true,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
        strategy: "jwe", // Use JWE for encrypted session cookies
        refreshCache: true,
      },
    },

    plugins: [
      anonymous(),
      nextCookies(), // Must be last plugin - handles cookie setting in Next.js
    ],

    // Account settings
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
}
