import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

// Users table for Better Auth
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
  name: text("name"),
  image: text("image"),
  isAnonymous: integer("is_anonymous", { mode: "boolean" }).default(false), // For anonymous plugin
  hatenaId: text("hatena_id"), // Hatena user ID (url_name) - multiple users can share same hatenaId across devices
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

// Sessions table for Better Auth
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

// Accounts table for OAuth providers (Better Auth)
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

// Verification tokens for email verification
export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

// OAuth Provider tables for MCP support
export const oauthClients = sqliteTable("oauth_clients", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().unique(),
  clientSecret: text("client_secret"),
  disabled: integer("disabled", { mode: "boolean" }).default(false),
  skipConsent: integer("skip_consent", { mode: "boolean" }).default(false),
  enableEndSession: integer("enable_end_session", { mode: "boolean" }).default(false),
  scopes: text("scopes"), // JSON array as text
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  referenceId: text("reference_id"),
  name: text("name"),
  uri: text("uri"),
  icon: text("icon"),
  contacts: text("contacts"), // JSON array as text
  tos: text("tos"),
  policy: text("policy"),
  softwareId: text("software_id"),
  softwareVersion: text("software_version"),
  softwareStatement: text("software_statement"),
  redirectUris: text("redirect_uris").notNull(), // JSON array as text
  tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
  grantTypes: text("grant_types"), // JSON array as text
  responseTypes: text("response_types"), // JSON array as text
  public: integer("public", { mode: "boolean" }).default(true),
  type: text("type"),
  metadata: text("metadata"), // JSON as text
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

export const oauthRefreshTokens = sqliteTable("oauth_refresh_tokens", {
  id: text("id").primaryKey(),
  token: text("token").notNull(),
  clientId: text("client_id").notNull(),
  sessionId: text("session_id"),
  userId: text("user_id").notNull(),
  referenceId: text("reference_id"),
  scopes: text("scopes").notNull(), // JSON array as text
  revoked: integer("revoked", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const oauthAccessTokens = sqliteTable("oauth_access_tokens", {
  id: text("id").primaryKey(),
  token: text("token").notNull(),
  clientId: text("client_id").notNull(),
  sessionId: text("session_id"),
  refreshId: text("refresh_id"),
  userId: text("user_id"),
  referenceId: text("reference_id"),
  scopes: text("scopes").notNull(), // JSON array as text
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const oauthConsents = sqliteTable("oauth_consents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  clientId: text("client_id").notNull(),
  referenceId: text("reference_id"),
  scopes: text("scopes").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

// Hatena OAuth tokens - keyed by hatenaId so multiple users can share the same token
export const hatenaTokens = sqliteTable("hatena_tokens", {
  hatenaId: text("hatena_id").primaryKey(), // Hatena user ID as primary key
  accessToken: text("access_token").notNull(),
  accessTokenSecret: text("access_token_secret").notNull(),
  scope: text("scope").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  hatenaToken: one(hatenaTokens, {
    fields: [users.hatenaId],
    references: [hatenaTokens.hatenaId],
  }),
}));

export const hatenaTokensRelations = relations(hatenaTokens, ({ many }) => ({
  users: many(users),
}));
