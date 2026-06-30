# Habu Bookmark Rewrite Plan

## Recommendation

Make Habu the source of truth for bookmarks and treat Hatena Bookmark as an external sync target. D1 should own bookmark metadata, user-visible state, sync status, and job status. R2 should own large raw content such as HTML, Markdown, extracted text, and optional chunks. Cloudflare AI Search should index R2 content and return search hits that Habu hydrates from D1 before display.

The current bookmark-agent project is useful as a source of domain logic, not as a runtime to copy. Reuse its Hatena import mapping, tag normalization, diff detection, and content-enrichment ideas. Rebuild storage, search, cron, and background processing around Cloudflare Workers, D1, R2, Queues, Workflows, and AI Search.

## Target State

- Habu D1 is the canonical bookmark database.
- Habu UI reads from D1-backed APIs, not from Hatena Bookmark responses.
- TanStack DB collections read and mutate Habu APIs from the frontend.
- Bookmark creation writes D1 first and returns quickly.
- Hatena Bookmark sync happens asynchronously through Cloudflare Queues.
- Raw and generated content lives in R2, with pointers and status in D1.
- AI generation runs in background jobs and stores compact outputs in D1.
- AI Search indexes R2 objects and powers natural-language and agentic search.
- D1 structured filters and AI Search retrieval are combined at query time.

## Current System Boundaries

### Habu Today

- Runtime: Next.js on Cloudflare Workers through OpenNext.
- Database: Cloudflare D1 with Better Auth tables, `hatena_tokens`, and `chat_threads`.
- Save flow: `/api/habu/bookmark` authenticates the user, optionally generates a comment, and posts directly to Hatena Bookmark.
- Client queue: Service Worker and Dexie provide browser-local retry behavior.
- Search and display: several flows still depend on Hatena Bookmark data as the external source.

### bookmark-agent Today

- Runtime: Next.js on Vercel.
- Database: Neon/Postgres through Drizzle.
- Bookmark table includes comment, description, URL, domain, Hatena URL, Markdown content, title, canonical URL, summary, normalized domain, Gemini File Search state, and timestamps.
- Importer combines Hatena fetch, Postgres upsert, tag sync, Markdown fetch, and Gemini indexing in one path.
- Postgres indexes use GIN/trigram/BRIN. Those should not be ported directly to D1.

## Design Principles

1. D1 owns small relational state.
   Keep rows compact and queryable. Do not store raw page content in the bookmark row.

2. R2 owns large content.
   Store raw HTML, Markdown, extracted text, and chunks as objects. D1 stores object keys, hashes, sizes, status, and timestamps.

3. Hatena sync is not part of the request path.
   The user should see the D1 bookmark immediately. Hatena failures should update sync status and retry through queues.

4. Search is a two-layer system.
   D1 handles ownership, authorization, tags, domains, dates, and sync state. AI Search handles semantic and hybrid retrieval over R2 content.

5. Jobs are idempotent.
   Every queue message must be safe to retry. Use bookmark ID, content hash, and job kind as idempotency keys.

6. Existing UI contracts should be preserved during migration.
   The current suggestion SSE progress contract should remain compatible until the background enrichment path replaces it intentionally.

## Storage Model

### D1 Tables

#### `bookmarks`

Canonical user-visible bookmark record.

Suggested fields:

- `id`
- `user_id`
- `hatena_id`
- `url`
- `canonical_url`
- `root_url`
- `domain`
- `normalized_domain`
- `title`
- `comment`
- `description`
- `summary`
- `source`
- `visibility`
- `bookmarked_at`
- `created_at`
- `updated_at`
- `deleted_at`
- `hatena_bookmark_url`
- `hatena_location_id`
- `hatena_sync_status`
- `hatena_synced_at`
- `hatena_sync_error`
- `content_status`
- `ai_status`
- `ai_search_status`

Important constraints:

- Unique key: `(user_id, canonical_url)` or `(user_id, url)`, depending on deduplication semantics.
- Keep `summary`, `description`, and `comment` short enough for D1.
- Do not store raw HTML or full Markdown here.

#### `tags`

Global or per-user tag dictionary.

Suggested fields:

- `id`
- `user_id`
- `label`
- `normalized_label`
- `created_at`
- `updated_at`

Suggested unique key:

- `(user_id, normalized_label)`

#### `bookmark_tags`

Many-to-many bookmark-tag relation.

Suggested fields:

- `bookmark_id`
- `tag_id`
- `user_id`
- `source`
- `created_at`
- `updated_at`

Suggested unique key:

- `(bookmark_id, tag_id)`

#### `bookmark_contents`

Pointer table for content objects.

Suggested fields:

- `bookmark_id`
- `content_kind`
- `r2_key`
- `content_type`
- `content_hash`
- `byte_size`
- `char_count`
- `chunk_count`
- `language`
- `status`
- `fetched_at`
- `indexed_at`
- `error`
- `created_at`
- `updated_at`

`content_kind` examples:

- `raw_html`
- `markdown`
- `extracted_text`
- `chunk_manifest`

#### `bookmark_content_chunks`

Optional D1 chunk metadata. The chunk body should usually stay in R2.

Suggested fields:

- `bookmark_id`
- `content_kind`
- `chunk_index`
- `r2_key`
- `content_hash`
- `byte_size`
- `char_count`
- `ai_search_document_id`
- `created_at`

Suggested unique key:

- `(bookmark_id, content_kind, chunk_index)`

#### `bookmark_jobs`

Durable job status and audit table for queue consumers.

Suggested fields:

- `id`
- `bookmark_id`
- `job_kind`
- `idempotency_key`
- `status`
- `attempt_count`
- `last_error`
- `available_at`
- `started_at`
- `completed_at`
- `created_at`
- `updated_at`

`job_kind` examples:

- `hatena_sync`
- `content_fetch`
- `ai_generate`
- `ai_search_index`
- `hatena_import`

#### `bookmark_ai_outputs`

Compact AI-generated outputs for UI display.

Suggested fields:

- `bookmark_id`
- `output_kind`
- `model`
- `prompt_version`
- `content_hash`
- `text`
- `json`
- `created_at`
- `updated_at`

`output_kind` examples:

- `summary`
- `suggested_comment`
- `suggested_tags`
- `language`
- `safety_classification`

## R2 Object Layout

Use stable, user-scoped keys. Avoid putting secrets or tokens in object keys.

Suggested layout:

```text
users/{userId}/bookmarks/{bookmarkId}/raw.html
users/{userId}/bookmarks/{bookmarkId}/content.md
users/{userId}/bookmarks/{bookmarkId}/extracted.txt
users/{userId}/bookmarks/{bookmarkId}/chunks/000.md
users/{userId}/bookmarks/{bookmarkId}/chunks/001.md
users/{userId}/bookmarks/{bookmarkId}/manifest.json
```

Object metadata should include only non-sensitive fields:

- `bookmarkId`
- `userId`
- `contentKind`
- `contentHash`
- `canonicalUrlHash`
- `createdAt`

Do not store OAuth tokens, cookies, Authorization headers, or private raw request metadata in R2.

## AI Search Model

AI Search should index R2 Markdown or extracted text, not D1 rows. D1 should store enough state to know whether each bookmark has been indexed.

Recommended indexing target:

- Prefer `content.md` when it is below the AI Search file-size limit.
- Use chunk objects when the page is large.
- Keep `raw.html` for audit and future extraction, but do not index it by default.

Recommended query flow:

1. User submits a search query.
2. Habu checks authorization and structured filters in D1.
3. Habu queries AI Search with query text and allowed metadata or prefix constraints.
4. Habu maps AI Search hits to `bookmark_id`.
5. Habu hydrates final result cards from D1.
6. Habu optionally fetches snippets or chunk text from R2.

This keeps AI Search as a retrieval system, not as the user-visible database.

## Frontend Data Flow with TanStack DB

Start with QueryCollection-backed collections over existing Habu APIs.

Suggested collections:

- `bookmarks`
- `tags`
- `bookmarkTags`
- `bookmarkContents`

Initial behavior:

- Eagerly load recent bookmarks and tag summaries.
- Use on-demand loading for search, historical pages, and content details.
- Use optimistic insert/update/delete for bookmark edits.
- Keep the current Dexie/Service Worker queue during the transition as a browser-local outbox.

Target behavior:

1. Frontend creates a bookmark through TanStack DB mutation.
2. API writes D1 and returns the D1 bookmark record.
3. API enqueues async jobs.
4. TanStack DB reflects `content_status`, `hatena_sync_status`, and `ai_search_status`.
5. UI shows local save success even if Hatena sync is still pending.

## API Shape

Suggested public API surface:

```text
GET    /api/habu/bookmarks
POST   /api/habu/bookmarks
GET    /api/habu/bookmarks/{id}
PATCH  /api/habu/bookmarks/{id}
DELETE /api/habu/bookmarks/{id}
GET    /api/habu/bookmarks/{id}/content
POST   /api/habu/bookmarks/{id}/resync
GET    /api/habu/search
POST   /api/habu/search
```

Compatibility:

- Keep `/api/habu/bookmark` temporarily as a compatibility shim.
- The shim should write D1 and enqueue jobs instead of posting directly to Hatena.
- Remove the shim only after the Service Worker, save form, and queue UI are migrated.

## Async Processing

### Queue: `hatena-sync`

Responsibilities:

- Read bookmark and Hatena token state from D1.
- Sign OAuth 1.0a requests.
- Create, update, or delete the Hatena bookmark.
- Update `hatena_sync_status`, `hatena_synced_at`, and `hatena_sync_error`.

Retry behavior:

- Retry transient network and Hatena errors.
- Use a dead-letter queue or failed status after repeated failures.
- Never drop the D1 bookmark because Hatena sync failed.

### Queue: `content-enrichment`

Responsibilities:

- Fetch page metadata.
- Fetch Browser Rendering Markdown.
- Store raw HTML or Markdown in R2.
- Update `bookmark_contents`.
- Enqueue AI generation and AI Search indexing.

Important rule:

- Content enrichment failure should not fail bookmark creation.

### Queue or Workflow: `ai-enrichment`

Responsibilities:

- Generate summary, suggested comment, tags, language, and safety metadata.
- Store compact outputs in `bookmark_ai_outputs`.
- Update `bookmarks.summary` or `bookmarks.comment` only when the product flow explicitly accepts generated content.

Use Cloudflare Workflows if the flow needs multiple durable steps, sleeps, external waits, or better resume semantics.

### Queue or Workflow: `ai-search-index`

Responsibilities:

- Select the R2 object or chunk set to index.
- Trigger AI Search sync or register content for indexing.
- Update `ai_search_status` and `indexed_at`.

## Migration Plan

### Phase 0: Decisions and Bindings

Decide:

- R2 bucket name and object layout.
- AI Search index name and metadata fields.
- Queue names and dead-letter policy.
- D1 deduplication key: `url` or `canonical_url`.
- Hatena sync direction: Habu-to-Hatena only, or periodic Hatena import reconciliation.

Add or plan bindings:

- D1: existing `DB`
- R2: bookmark content bucket
- Queues: Hatena sync, content enrichment, AI enrichment, AI Search indexing
- AI Search binding or REST configuration
- Optional Workflows binding

### Phase 1: D1 Canonical Bookmark Schema

Add D1 tables for bookmarks, tags, tag relations, content pointers, jobs, and AI outputs.

No UI behavior needs to change in this phase.

### Phase 2: Import and Backfill

Create an importer that reuses bookmark-agent mapping logic but splits side effects:

1. Fetch Hatena bookmarks or read bookmark-agent export data.
2. Upsert D1 bookmark metadata.
3. Sync tags.
4. Enqueue content enrichment.
5. Enqueue AI Search indexing only after R2 content exists.

Do not fetch Markdown or index AI content inline during import.

### Phase 3: D1 Read Path

Switch bookmark list, detail, and tag views to D1 APIs.

Hatena data should become sync metadata, not the display source.

### Phase 4: D1 Write Path and Async Hatena Sync

Change save/edit/delete flows to write D1 first.

Then enqueue Hatena sync. UI should display:

- `saved`
- `syncing to Hatena`
- `Hatena sync failed`
- `content processing`
- `indexed for search`

### Phase 5: TanStack DB

Introduce TanStack DB collections around the D1-backed API.

Start with:

- read-only bookmark collection
- optimistic bookmark creation
- optimistic edit/delete
- status updates from refetch or polling

Do not replace all local offline behavior at once. Keep Dexie as the browser outbox until the new write path is stable.

### Phase 6: R2 Content and AI Search

Store Markdown and extracted text in R2. Index R2 content with AI Search. Hydrate search results from D1.

Add consistency checks:

- D1 bookmark exists.
- R2 content exists.
- AI Search index status is current for the content hash.
- Failed indexing jobs are visible.

### Phase 7: bookmark-agent Decommission

Stop bookmark-agent cron after these checks pass:

- D1 count matches expected bookmark count.
- Hatena sync queue has no unexpected backlog.
- R2 content coverage is acceptable.
- AI Search coverage is acceptable.
- Failed jobs are understood and retryable or intentionally ignored.

## Data Ownership Rules

- D1 bookmark row is the source of truth for user-visible bookmark state.
- R2 object is the source of truth for raw and large derived content.
- AI Search is a derived retrieval index.
- Hatena Bookmark is an external sync target.
- Existing bookmark-agent data is a migration source, not an ongoing authority.

## Failure Handling

Bookmark creation should be successful when D1 write succeeds.

Downstream failures update state:

- Hatena sync failure: bookmark remains saved with failed sync status.
- Content fetch failure: bookmark remains saved without raw content.
- AI generation failure: bookmark remains saved without AI output.
- AI Search indexing failure: bookmark remains saved but unavailable to semantic search.

Every failure path should be visible in D1 and retryable.

## Security and Privacy

- Never store OAuth tokens in R2.
- Never put secrets in R2 object keys.
- Avoid storing request headers, cookies, authorization headers, or rendered private page content unless the product explicitly supports private captures.
- Scope all D1 queries by `user_id`.
- Scope R2 keys by `userId` and `bookmarkId`.
- Do not trust AI Search hits for authorization. Always hydrate and authorize through D1.

## Open Questions

1. Should Habu periodically import direct Hatena-side edits?
2. Should deduplication use original URL or canonical URL?
3. Should generated tags be auto-applied or stored as suggestions first?
4. Should large content be chunked before R2 write or only before AI Search indexing?
5. Should chat gain write tools, or remain search-only until the rewrite stabilizes?

## Implementation Order

1. Add D1 schema for bookmarks, tags, content pointers, jobs, and AI outputs.
2. Add R2 and Queue bindings to Wrangler.
3. Build D1-backed bookmark APIs.
4. Keep existing save UI but route writes into D1 and queue Hatena sync.
5. Add import/backfill from bookmark-agent or Hatena.
6. Add content enrichment queue and R2 storage.
7. Add AI Search indexing and search API.
8. Add TanStack DB collections.
9. Migrate UI from Hatena-backed reads to D1-backed reads.
10. Decommission bookmark-agent.

## References

- TanStack DB overview: https://tanstack.com/db/latest/docs/overview
- Cloudflare D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare R2: https://developers.cloudflare.com/r2/
- Cloudflare Queues: https://developers.cloudflare.com/queues/
- Cloudflare Workflows: https://developers.cloudflare.com/workflows/
- Cloudflare Browser Run Markdown endpoint: https://developers.cloudflare.com/browser-run/quick-actions/markdown-endpoint/
- Cloudflare AI Search overview: https://developers.cloudflare.com/ai-search/
- Cloudflare AI Search R2 data source: https://developers.cloudflare.com/ai-search/configuration/data-source/r2/
- Cloudflare AI Search sync: https://developers.cloudflare.com/ai-search/configuration/indexing/syncing/
- Cloudflare AI Search limits: https://developers.cloudflare.com/ai-search/platform/limits-pricing/
