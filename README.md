# habu - Hatena Bookmark Utility

Quick bookmark saving PWA for Hatena Bookmark with offline support.

## Features

- 🚀 **One-tap bookmark saving** via Web Share Target
- 📱 **PWA** - Install as a mobile app
- 🔄 **Offline-first** - Queue bookmarks locally with IndexedDB
- 🔐 **Secure authentication** - Better Auth with Cloudflare D1
- ☁️ **Cloudflare Workers** - Fast, global edge deployment
- 🎯 **Automatic sync** - Background synchronization with Hatena

## Architecture

- **Framework**: Next.js 16 (App Router)
- **Authentication**: Better Auth with anonymous plugin
- **Deployment**: OpenNext → Cloudflare Workers
- **Database**: Cloudflare D1 (for Better Auth sessions and Hatena tokens)
- **Client Storage**: IndexedDB (Dexie.js) for bookmark queue
- **Service Worker**: Serwist for PWA + fetch interception
- **Hatena Integration**: OAuth 1.0a + server-side signing
- **UI**: shadcn/ui + Tailwind CSS v4

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Copy `.dev.vars.example` to `.dev.vars`:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your credentials:

```env
NEXTJS_ENV=development
BETTER_AUTH_SECRET=your-secret-key-here
HATENA_CONSUMER_KEY=your-hatena-consumer-key
HATENA_CONSUMER_SECRET=your-hatena-consumer-secret
```

### 3. Register Hatena OAuth App

1. Go to https://www.hatena.ne.jp/oauth/develop
2. Create a new application
3. Set callback URL to: `https://your-domain.com/api/habu/oauth/callback`
4. Copy the consumer key and secret to `.dev.vars`

### 4. Run development server

```bash
pnpm dev
```

### 5. Deploy to Cloudflare

First, build and preview locally:

```bash
pnpm preview
```

Then deploy:

```bash
pnpm deploy
```

Make sure to set environment variables in Cloudflare:

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put HATENA_CONSUMER_KEY
wrangler secret put HATENA_CONSUMER_SECRET
```

## Usage

### Initial Setup

1. Open habu and sign in
2. Go to Settings
3. Click "Connect Hatena" and authorize the app

### Saving Bookmarks

**Method 1: Web Share Target (Mobile)**
1. Share any page from your browser or app
2. Select "habu" from the share menu
3. Bookmark is saved instantly

**Method 2: Manual Entry**
1. Open habu
2. Click "Add Bookmark"
3. Enter URL and optional comment
4. Click "Save"

### Queue Management

- View all bookmarks in `/queue`
- See status: queued, sending, done, or error
- Retry failed bookmarks
- Automatic sync via Background Sync API (when online)
- Manual sync with "Sync Now" button

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...all]/       # Better Auth endpoints
│   │   └── habu/
│   │       ├── oauth/           # Hatena OAuth flow
│   │       └── bookmark/        # Bookmark API
│   ├── share/                   # Web Share Target endpoint
│   ├── saved/                   # Success feedback page
│   ├── queue/                   # Queue management UI
│   ├── settings/                # Settings & Hatena connection
│   ├── sw.ts                    # Service Worker (fetch interception)
│   └── page.tsx                 # Home page
├── lib/
│   ├── auth.ts                  # Better Auth config
│   ├── hatena-oauth.ts          # OAuth 1.0a helpers
│   ├── queue-db.ts              # IndexedDB operations
│   └── queue-sync.ts            # Client sync trigger
├── components/
│   ├── background-sync.tsx      # Fallback sync for Safari
│   └── sw-register.tsx          # Service Worker registration
└── types/
    └── habu.ts                  # TypeScript types
```

## Flow Diagrams

### Authentication Flow

1. User signs in with Better Auth
2. Click "Connect Hatena" in Settings
3. Redirect to Hatena OAuth authorization
4. Callback stores tokens in stateless session
5. Ready to save bookmarks

### Bookmark Save Flow

1. Client calls `fetch("/api/habu/bookmark")` with `keepalive: true`
2. Service Worker intercepts the request
3. SW saves to IndexedDB (status: `sending`) for UI tracking
4. If online: forwards to server → Hatena API
   - Success → Status: `done`
   - Error → Status: `error` (with retry scheduling)
5. If offline: Status: `queued`, registers Background Sync
6. When back online: Background Sync triggers queue processing
7. Exponential backoff retry: 1min → 5min → 15min → 60min

## License

MIT
