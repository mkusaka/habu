# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

habu is a PWA (Progressive Web App) for quickly saving bookmarks to Hatena Bookmark with offline-first support. It uses IndexedDB for local queueing and syncs with Hatena's API using OAuth 1.0a authentication.

## Key Architecture Decisions

### Deployment & Runtime
- **Platform**: Cloudflare Workers via OpenNext
- **Framework**: Next.js 16 (App Router) with Turbopack
- **Database**: Cloudflare D1 (SQLite) for auth, IndexedDB (Dexie.js) for client-side queue
- **Authentication**: Better Auth with anonymous plugin (stateless session using JWE)
- **OAuth**: Custom OAuth 1.0a implementation for Hatena (using oauth-1.0a + CryptoJS for HMAC-SHA1)

### State Management Pattern
The app is completely **stateless on the server** - user sessions and OAuth tokens are stored in encrypted JWE cookies (Better Auth's `cookieCache`). Cloudflare D1 stores Better Auth tables but the primary data flow is:

1. User shares/adds bookmark → saved to IndexedDB queue (client-side)
2. Background sync sends queued items to `/api/habu/bookmark`
3. Server signs OAuth request using tokens from session cookie
4. Hatena API creates bookmark
5. Client updates queue status

### OAuth Flow (Hatena)
Hatena uses OAuth 1.0a with specific requirements:
- **Request token**: Must include `scope=read_public,read_private,write_public` in signature calculation AND body (but NOT in Authorization header)
- **Access token**: `oauth_verifier` must be in signature but sent ONLY in body
- **API requests**: Use `createSignedRequest()` from `src/lib/hatena-oauth.ts`
- Tokens are stored in D1 `hatena_tokens` table, linked to Better Auth users
- **Scopes**: `read_public` (public bookmarks), `read_private` (private bookmarks + tags list), `write_public` (create/edit)

### Client Storage (IndexedDB)
- Database: `HabuDatabase` in `src/lib/queue-db.ts`
- Table: `bookmarks` with fields: id, url, title, comment, status, createdAt, updatedAt, retryCount, nextRetryAt, lastError
- Status flow: `queued` → `sending` → `done` or `error`
- Retry logic: exponential backoff (1min, 5min, 15min, up to 60min)

## Development Commands

```bash
# Development
pnpm install              # Install dependencies
pnpm dev                  # Start dev server (localhost:3000)
pnpm lint                 # Run ESLint

# Database (D1)
pnpm db:generate          # Generate Drizzle migrations from schema
pnpm db:migrate:local     # Apply migrations to local D1 (wrangler dev)
pnpm db:migrate:remote    # Apply migrations to production D1

# Deployment
pnpm preview              # Build + preview locally with Cloudflare Workers
pnpm deploy               # Deploy to Cloudflare Workers
pnpm upload               # Build and upload (no preview)

# Cloudflare
pnpm cf-typegen           # Generate CloudflareEnv types from wrangler.toml
```

## Environment Variables

Required in `.dev.vars` (local) and Cloudflare secrets (production):
- `NEXTJS_ENV`: `development` or `production`
- `BETTER_AUTH_SECRET`: Random string for session encryption
- `HATENA_CONSUMER_KEY`: From https://www.hatena.ne.jp/oauth/develop
- `HATENA_CONSUMER_SECRET`: From Hatena OAuth app

For AI-powered suggestions (`/api/habu/suggest`):
- `BROWSER_RENDERING_ACCOUNT_ID`: Your Cloudflare account ID (note: `CF_*` and `CLOUDFLARE_*` prefixes are reserved by Wrangler)
- `BROWSER_RENDERING_API_TOKEN`: API token with Browser Rendering permissions
- `OPENAI_API_KEY`: OpenAI API key for moderation
- `GROQ_API_KEY`: Groq API key for GPT-OSS-120B (from https://console.groq.com/keys)
- `MASTRA_CLOUD_ACCESS_TOKEN`: Mastra Cloud access token for AI tracing

Set production secrets with:
```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put HATENA_CONSUMER_KEY
wrangler secret put HATENA_CONSUMER_SECRET
wrangler secret put BROWSER_RENDERING_ACCOUNT_ID
wrangler secret put BROWSER_RENDERING_API_TOKEN
wrangler secret put OPENAI_API_KEY
wrangler secret put GROQ_API_KEY
wrangler secret put MASTRA_CLOUD_ACCESS_TOKEN
```

## Important Implementation Details

### Better Auth + Cloudflare D1
- Auth instance is created per-request in API routes via `createAuth(env.DB)` (see `src/lib/auth.ts:10`)
- D1 binding must be passed from Cloudflare Workers env
- Session cookies use JWE encryption (7-day expiry, auto-refresh)
- Anonymous plugin allows guest users to create sessions before OAuth

### PWA Features
- Web Share Target: `/api/share` receives shared URLs from mobile browsers
- Service Worker: `src/app/sw.ts` (Serwist-based, generates public/sw.js)
- Manifest: `public/manifest.json` defines share_target configuration
- Offline support: All bookmarks saved locally first, synced when online

### Background Sync
- Client-side sync runs every 30 seconds (see `src/lib/queue-sync.ts:78`)
- Also triggers on: page visibility change, online event, after adding bookmark
- Uses fetch with `credentials: 'include'` to send session cookies

### API Routes Structure
- `/api/auth/[...all]`: Better Auth endpoints (sign-in, session, etc.)
- `/api/habu/oauth/start`: Initiates Hatena OAuth flow
- `/api/habu/oauth/callback`: Handles OAuth callback, stores tokens
- `/api/habu/bookmark`: Creates bookmark on Hatena (with optional AI-generated summary+tags when no comment provided)
- `/api/habu/status`: Checks if user has connected Hatena
- `/api/share`: Web Share Target endpoint (POST)

### AI-Powered Suggestions
When `/api/habu/bookmark` is called without a comment:
1. Cloudflare Browser Rendering fetches page content as Markdown
2. Hatena API fetches user's existing tags
3. Groq GPT-OSS-120B generates summary (Japanese, max 100 chars) and tags (page language, max 10)
4. Formatted as `[tag1][tag2]summary` and sent to Hatena

Requires environment variables: `BROWSER_RENDERING_ACCOUNT_ID`, `BROWSER_RENDERING_API_TOKEN`, `OPENAI_API_KEY` (for moderation), `GROQ_API_KEY`, `MASTRA_CLOUD_ACCESS_TOKEN`

## Testing Hatena OAuth Locally

1. Register OAuth app at https://www.hatena.ne.jp/oauth/develop
2. Set callback URL to `http://localhost:3000/api/habu/oauth/callback`
3. Copy credentials to `.dev.vars`
4. Run `pnpm dev` and test at http://localhost:3000/settings

## Database Schema

Better Auth tables: `users`, `sessions`, `accounts`, `verifications`
Custom table: `hatena_tokens` (userId, accessToken, accessTokenSecret, scope)

Schema location: `src/db/schema.ts`
Migrations: `drizzle/` directory

## Path Aliases

- `@/*` → `src/*` (configured in tsconfig.json)

## UI Components

Built with shadcn/ui + Tailwind CSS v4:
- Components in `src/components/ui/`
- shadcn config: `components.json`
- Custom components: `background-sync.tsx`, `auto-save-toggle.tsx`, `sw-register.tsx`

## Common Pitfalls

1. **OAuth signature failures**: Ensure all parameters in `data` are included in signature (oauth-1.0a library requirement)
2. **Missing D1 binding**: Always pass `env.DB` to `createAuth()` in API routes
3. **Session cookies in Cloudflare**: Must use `nextCookies()` plugin as last Better Auth plugin
4. **IndexedDB version changes**: Must increment version in `HabuDatabase.constructor()` and add upgrade path
5. **Turbopack warnings**: Serwist shows warnings with Turbopack (suppressed via `SERWIST_SUPPRESS_TURBOPACK_WARNING=1`)
