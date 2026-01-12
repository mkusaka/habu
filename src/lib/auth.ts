import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

// MCP OAuth 2.1 scopes
export const MCP_SCOPES = [
  "bookmark:read",
  "bookmark:write",
  "bookmark:delete",
  "bookmark:suggest",
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

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
        jwks: schema.jwkss,
        oauthClient: schema.oauthClients,
        oauthRefreshToken: schema.oauthRefreshTokens,
        oauthAccessToken: schema.oauthAccessTokens,
        oauthConsent: schema.oauthConsents,
      },
    }),

    secret: process.env.BETTER_AUTH_SECRET || "change-this-secret-in-production",

    // Disable /token path to avoid conflict with JWT plugin
    disabledPaths: ["/token"],

    // Configure session
    session: {
      // Store sessions in database (required for OAuth Provider)
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
      // JWT plugin required for OAuth 2.1 Provider
      jwt(),
      // OAuth 2.1 Provider for MCP
      oauthProvider({
        loginPage: "/sign-in",
        consentPage: "/mcp/consent",
        // Custom scopes for bookmark operations
        scopes: ["openid", "profile", "email", "offline_access", ...MCP_SCOPES],
        // JWT access tokens (not stored in DB)
        accessTokenExpiresIn: 3600, // 1 hour
        refreshTokenExpiresIn: 86400 * 7, // 7 days
        // Valid audiences for JWT verification
        validAudiences: [process.env.BETTER_AUTH_URL || "https://habu.example.com"],
        // Dynamic client registration for MCP clients
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true, // For public MCP clients
      }),
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

// Type-safe auth client
export type Auth = ReturnType<typeof createAuth>;
