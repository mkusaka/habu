# Fetch API Specification

## POST /api/habu/bookmark

Creates a bookmark on Hatena Bookmark service.

### Request

**Method:** `POST`

**URL:** `/api/habu/bookmark`

**Headers:**
| Header | Value | Required |
|--------|-------|----------|
| Content-Type | `application/json` | Yes |
| Cookie | `__Secure-better-auth.session_token=...` | Yes (auto-included with `credentials: "include"`) |
| Origin | Must match request URL origin | Yes (for CSRF protection) |

**Body:**
```json
{
  "url": "https://example.com/page",
  "comment": "Optional comment text"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| url | string | Yes | The URL to bookmark. Must be a valid URL format. |
| comment | string | No | Optional comment to attach to the bookmark. |

### Response

**Success (200 OK):**
```json
{
  "success": true
}
```

**Queued (202 Accepted) - Synthetic response from Service Worker when offline:**
```json
{
  "success": true,
  "queued": true
}
```

**Error Responses:**

| Status | Body | Description |
|--------|------|-------------|
| 400 | `{ "success": false, "error": "URL is required" }` | Missing URL in request body |
| 400 | `{ "success": false, "error": "Invalid URL format" }` | URL is not a valid format |
| 400 | `{ "success": false, "error": "Hatena not connected" }` | User has not connected their Hatena account |
| 401 | `{ "success": false, "error": "Not authenticated" }` | No valid session cookie |
| 403 | `{ "success": false, "error": "Invalid origin" }` | CSRF protection: Origin header mismatch |
| 403 | `{ "success": false, "error": "Invalid referer" }` | CSRF protection: Referer header mismatch |
| 4xx/5xx | `{ "success": false, "error": "Hatena API error: {status}" }` | Hatena API returned an error |
| 500 | `{ "success": false, "error": "{error message}" }` | Internal server error |

### Example

**Request:**
```bash
curl 'https://habu.polyfill.workers.dev/api/habu/bookmark' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://habu.polyfill.workers.dev' \
  -b '__Secure-better-auth.session_token=...' \
  --data-raw '{"url":"https://example.com/article","comment":"Great article!"}'
```

**Success Response:**
```json
{
  "success": true
}
```

---

## Architecture Overview

The bookmark saving flow uses **Service Worker fetch interception** for offline-first reliability:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
│  ┌──────────────┐     ┌─────────────────────────────────────┐   │
│  │  Share Form  │────>│  fetch("/api/habu/bookmark", {...}) │   │
│  └──────────────┘     │  keepalive: true                     │   │
│                        └───────────────┬─────────────────────┘   │
└────────────────────────────────────────┼─────────────────────────┘
                                         │
┌────────────────────────────────────────┼─────────────────────────┐
│                    Service Worker (sw.ts)                         │
│                                        ▼                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Fetch Event Handler                              │ │
│  │  1. Parse request body                                        │ │
│  │  2. Save to IndexedDB (status: "sending")                     │ │
│  │  3. If online → forward to server                             │ │
│  │     - On success → update to "done"                           │ │
│  │     - On error → update to "queued", register Background Sync │ │
│  │  4. If offline → update to "queued", register Background Sync │ │
│  │     Return synthetic: { success: true, queued: true }         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │           Background Sync Event Handler                       │ │
│  │  Triggered when browser comes online:                         │ │
│  │  1. Get queued/error items from IndexedDB                     │ │
│  │  2. Send each to server                                       │ │
│  │  3. Update status (done/error with retry scheduling)          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌───────────────────────────────────────────────────────────────────┐
│                    Server (Cloudflare Workers)                     │
│  POST /api/habu/bookmark                                           │
│  1. Validate session cookie                                        │
│  2. Get Hatena tokens from D1                                      │
│  3. Sign request with OAuth 1.0a                                   │
│  4. Call Hatena Bookmark API                                       │
│  5. Return { success: true/false }                                 │
└───────────────────────────────────────────────────────────────────┘
```

---

## Client-Side Implementation

### Save Bookmark (`queue-sync.ts`)

```typescript
export async function saveBookmark(
  url: string,
  title?: string,
  comment?: string
): Promise<BookmarkResponse & { queued?: boolean }> {
  const response = await fetch("/api/habu/bookmark", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ url, title, comment }),
    keepalive: true, // Allow request to complete even if page closes
  });

  return response.json();
}
```

### Usage in Components

```typescript
const result = await saveBookmark(url, title, comment);

if (result.success) {
  if (result.queued) {
    // Saved offline, will sync when online
    toast.success("Bookmark queued (will sync when online)");
  } else {
    // Saved immediately
    toast.success("Bookmark saved!");
  }
} else {
  toast.error(result.error || "Failed to save bookmark");
}
```

---

## TypeScript Types

```typescript
// src/types/habu.ts

export interface BookmarkRequest {
  url: string;
  title?: string;
  comment?: string;
}

export interface BookmarkResponse {
  success: boolean;
  error?: string;
}
```

---

## Authentication Flow

1. User authenticates via Better Auth (anonymous session or OAuth)
2. User connects Hatena account via OAuth 1.0a (`/api/habu/oauth/start` → `/api/habu/oauth/callback`)
3. Hatena access tokens are stored in D1 database (`hatena_tokens` table)
4. When calling `/api/habu/bookmark`:
   - Session is validated from cookie
   - Hatena tokens are retrieved from D1
   - Request is signed with OAuth 1.0a and sent to Hatena Bookmark API

---

## Rate Limiting & Retry

The Service Worker implements exponential backoff for failed requests:

| Retry Count | Delay |
|-------------|-------|
| 1 | 1 minute |
| 2 | 5 minutes |
| 3 | 15 minutes |
| 4+ | 60 minutes |

Retry is triggered by:
- **Background Sync API** (automatic when browser comes online)
- Manual "Sync Now" button on Queue page
