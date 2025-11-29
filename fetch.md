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

## Client-Side Fetch Implementation

### From Service Worker (`sw.ts`)

```typescript
const response = await fetch("/api/habu/bookmark", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  credentials: "include",  // Include session cookies
  body: JSON.stringify({
    url: item.url,
    comment: item.comment,
  }),
  signal: AbortSignal.timeout(30000),  // 30 second timeout
  keepalive: true,  // Allow request to complete even if page closes
});

const result = await response.json();
// result: { success: boolean; error?: string }
```

### From Client (`queue-sync.ts`)

```typescript
const response = await fetch("/api/habu/bookmark", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  credentials: "include",
  body: JSON.stringify({
    url: item.url,
    comment: item.comment,
  } as BookmarkRequest),
  signal: AbortSignal.timeout(30000),
  keepalive: true,
});

const result: BookmarkResponse = await response.json();
```

---

## TypeScript Types

```typescript
// src/types/habu.ts

export interface BookmarkRequest {
  url: string;
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

The client implements exponential backoff for failed requests:

| Retry Count | Delay |
|-------------|-------|
| 1 | 1 minute |
| 2 | 5 minutes |
| 3 | 15 minutes |
| 4+ | 60 minutes |

Retry is triggered by:
- 30-second polling (`startBackgroundSync`)
- Browser online event
- Page visibility change
- Manual "Sync Now" button
