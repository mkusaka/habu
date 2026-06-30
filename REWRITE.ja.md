# Habu ブックマーク基盤リライト計画

## 推奨方針

Habuをブックマークの正本にし、Hatena Bookmarkは外部同期先として扱う。D1はブックマークのメタデータ、ユーザーに表示する状態、同期状態、ジョブ状態を持つ。R2はHTML、Markdown、抽出テキスト、必要に応じたchunkなど大きな本文データを持つ。Cloudflare AI SearchはR2上のcontentをindexし、検索hitをHabu側でD1からhydrateして表示する。

現在のbookmark-agent projectは、そのままruntimeとして移植する対象ではなく、ドメインロジックの移植元として扱う。Hatena import mapping、tag正規化、差分判定、content enrichmentの考え方は再利用する。一方で、storage、search、cron、background processingはCloudflare Workers、D1、R2、Queues、Workflows、AI Search前提で作り直す。

## 目標状態

- HabuのD1がcanonicalなブックマークDBになる。
- Habu UIはHatena Bookmarkのresponseではなく、D1-backed APIを読む。
- frontendはTanStack DB collectionでHabu APIを読み書きする。
- ブックマーク作成はD1に先に書き込み、すぐ返す。
- Hatena Bookmark同期はCloudflare Queues経由で非同期に行う。
- raw contentと生成contentはR2に置き、D1にはpointerと状態を持たせる。
- AI生成はbackground jobで実行し、短い出力だけD1に保存する。
- AI SearchはR2 objectをindexし、自然文検索とagentic searchに使う。
- query時はD1の構造化filterとAI Search retrievalを組み合わせる。

## 現在のシステム境界

### 現在のHabu

- Runtime: OpenNext経由のCloudflare Workers上のNext.js。
- Database: Better Auth tables、`hatena_tokens`、`chat_threads` を持つCloudflare D1。
- Save flow: `/api/habu/bookmark` がユーザー認証し、必要ならcommentを生成し、同期的にHatena Bookmarkへ投稿する。
- Client queue: Service WorkerとDexieがブラウザローカルのretryを担う。
- Search/display: いくつかのflowはまだ外部sourceとしてHatena Bookmark dataに依存している。

### 現在のbookmark-agent

- Runtime: Vercel上のNext.js。
- Database: Drizzle経由のNeon/Postgres。
- Bookmark tableはcomment、description、URL、domain、Hatena URL、Markdown content、title、canonical URL、summary、normalized domain、Gemini File Search状態、timestampを持つ。
- ImporterはHatena fetch、Postgres upsert、tag sync、Markdown fetch、Gemini indexingを1つのpathにまとめている。
- Postgres indexはGIN/trigram/BRINを使う。これはD1へ直接移植しない。

## 設計原則

1. D1は小さなrelational stateを持つ。
   rowを小さく、queryしやすく保つ。raw page contentをbookmark rowに保存しない。

2. R2は大きなcontentを持つ。
   raw HTML、Markdown、抽出テキスト、chunkはobjectとして保存する。D1にはobject key、hash、size、status、timestampを保存する。

3. Hatena syncはrequest pathに入れない。
   ユーザーにはD1 bookmarkを即時表示する。Hatena failureはsync statusを更新し、queueでretryする。

4. Searchは二層構成にする。
   D1はownership、authorization、tag、domain、date、sync stateを扱う。AI SearchはR2 contentに対するsemantic/hybrid retrievalを扱う。

5. Jobはidempotentにする。
   すべてのqueue messageはretryされても安全にする。bookmark ID、content hash、job kindをidempotency keyとして使う。

6. 移行中は既存UI contractを保つ。
   現在のsuggestion SSE progress contractは、background enrichment pathへ意図的に置き換えるまで互換維持する。

## Storage Model

### D1 Tables

#### `bookmarks`

ユーザーに表示するcanonical bookmark record。

推奨field:

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

重要な制約:

- unique keyはdeduplication semanticsに応じて `(user_id, canonical_url)` または `(user_id, url)` にする。
- `summary`、`description`、`comment` はD1に収まる短い値にする。
- raw HTMLやfull Markdownはここに保存しない。

#### `tags`

globalまたはuser別のtag dictionary。

推奨field:

- `id`
- `user_id`
- `label`
- `normalized_label`
- `created_at`
- `updated_at`

推奨unique key:

- `(user_id, normalized_label)`

#### `bookmark_tags`

bookmarkとtagのmany-to-many relation。

推奨field:

- `bookmark_id`
- `tag_id`
- `user_id`
- `source`
- `created_at`
- `updated_at`

推奨unique key:

- `(bookmark_id, tag_id)`

#### `bookmark_contents`

content objectへのpointer table。

推奨field:

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

`content_kind` の例:

- `raw_html`
- `markdown`
- `extracted_text`
- `chunk_manifest`

#### `bookmark_content_chunks`

任意のD1 chunk metadata。chunk本文は通常R2に置く。

推奨field:

- `bookmark_id`
- `content_kind`
- `chunk_index`
- `r2_key`
- `content_hash`
- `byte_size`
- `char_count`
- `ai_search_document_id`
- `created_at`

推奨unique key:

- `(bookmark_id, content_kind, chunk_index)`

#### `bookmark_jobs`

queue consumer用のdurable job statusとaudit table。

推奨field:

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

`job_kind` の例:

- `hatena_sync`
- `content_fetch`
- `ai_generate`
- `ai_search_index`
- `hatena_import`

#### `bookmark_ai_outputs`

UI表示用の短いAI生成結果。

推奨field:

- `bookmark_id`
- `output_kind`
- `model`
- `prompt_version`
- `content_hash`
- `text`
- `json`
- `created_at`
- `updated_at`

`output_kind` の例:

- `summary`
- `suggested_comment`
- `suggested_tags`
- `language`
- `safety_classification`

## R2 Object Layout

安定したuser-scoped keyを使う。object keyにsecretやtokenを入れない。

推奨layout:

```text
users/{userId}/bookmarks/{bookmarkId}/raw.html
users/{userId}/bookmarks/{bookmarkId}/content.md
users/{userId}/bookmarks/{bookmarkId}/extracted.txt
users/{userId}/bookmarks/{bookmarkId}/chunks/000.md
users/{userId}/bookmarks/{bookmarkId}/chunks/001.md
users/{userId}/bookmarks/{bookmarkId}/manifest.json
```

object metadataにはsensitiveでないfieldだけを入れる:

- `bookmarkId`
- `userId`
- `contentKind`
- `contentHash`
- `canonicalUrlHash`
- `createdAt`

OAuth token、cookie、Authorization header、private raw request metadataはR2に保存しない。

## AI Search Model

AI SearchはD1 rowではなく、R2上のMarkdownまたは抽出テキストをindexする。D1には各bookmarkがindex済みか判断できる状態を持たせる。

推奨index対象:

- AI Searchのfile-size limit未満なら `content.md` を優先する。
- pageが大きい場合はchunk objectを使う。
- `raw.html` はauditと将来の再抽出用に保持するが、defaultではindexしない。

推奨query flow:

1. ユーザーがsearch queryを送る。
2. HabuがD1でauthorizationとstructured filterを確認する。
3. Habuがquery textと許可されたmetadataまたはprefix constraintを使ってAI Searchへ問い合わせる。
4. HabuがAI Search hitを `bookmark_id` に対応づける。
5. Habuが最終result cardをD1からhydrateする。
6. 必要ならsnippetやchunk textをR2から取得する。

これにより、AI Searchはretrieval systemに留まり、ユーザー表示用databaseにはならない。

## TanStack DBによるFrontend Data Flow

まずは既存Habu API上にQueryCollection-backed collectionを作る。

推奨collection:

- `bookmarks`
- `tags`
- `bookmarkTags`
- `bookmarkContents`

初期挙動:

- 最近のbookmarkとtag summaryはeagerに読む。
- search、過去page、content detailはon-demandで読む。
- bookmark editはoptimistic insert/update/deleteを使う。
- 移行中は現在のDexie/Service Worker queueをブラウザローカルoutboxとして残す。

目標挙動:

1. frontendがTanStack DB mutationでbookmarkを作成する。
2. APIがD1に書き込み、D1 bookmark recordを返す。
3. APIがasync jobをenqueueする。
4. TanStack DBが `content_status`、`hatena_sync_status`、`ai_search_status` を反映する。
5. Hatena syncがpendingでも、UIはlocal save successを表示する。

## API Shape

推奨public API surface:

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

互換性:

- `/api/habu/bookmark` は一時的にcompatibility shimとして残す。
- shimはHatenaへ直接投稿せず、D1に書いてjobをenqueueする。
- Service Worker、save form、queue UIの移行後にだけshimを削除する。

## Async Processing

### Queue: `hatena-sync`

責務:

- D1からbookmarkとHatena token状態を読む。
- OAuth 1.0a requestに署名する。
- Hatena bookmarkをcreate、update、deleteする。
- `hatena_sync_status`、`hatena_synced_at`、`hatena_sync_error` を更新する。

retry behavior:

- transientなnetwork errorとHatena errorはretryする。
- 繰り返し失敗したらdead-letter queueまたはfailed statusにする。
- Hatena syncに失敗してもD1 bookmarkは削除しない。

### Queue: `content-enrichment`

責務:

- page metadataをfetchする。
- Browser Rendering Markdownをfetchする。
- raw HTMLまたはMarkdownをR2に保存する。
- `bookmark_contents` を更新する。
- AI generationとAI Search indexingをenqueueする。

重要なルール:

- content enrichment failureでbookmark creationを失敗にしない。

### Queue or Workflow: `ai-enrichment`

責務:

- summary、suggested comment、tags、language、safety metadataを生成する。
- 短い出力を `bookmark_ai_outputs` に保存する。
- product flowが明示的に生成contentを採用した場合だけ、`bookmarks.summary` や `bookmarks.comment` を更新する。

複数のdurable step、sleep、external wait、resume semanticsが必要ならCloudflare Workflowsを使う。

### Queue or Workflow: `ai-search-index`

責務:

- index対象のR2 objectまたはchunk setを選ぶ。
- AI Search syncをtriggerする、またはindexing対象として登録する。
- `ai_search_status` と `indexed_at` を更新する。

## Migration Plan

### Phase 0: Decisions and Bindings

決めること:

- R2 bucket名とobject layout。
- AI Search index名とmetadata fields。
- Queue名とdead-letter policy。
- D1 deduplication key: `url` か `canonical_url`。
- Hatena sync direction: Habu-to-Hatenaのみか、定期的なHatena import reconciliationも行うか。

追加または計画するbinding:

- D1: 既存の `DB`
- R2: bookmark content bucket
- Queues: Hatena sync、content enrichment、AI enrichment、AI Search indexing
- AI Search bindingまたはREST設定
- 任意のWorkflows binding

### Phase 1: D1 Canonical Bookmark Schema

bookmarks、tags、tag relations、content pointers、jobs、AI outputs用のD1 tableを追加する。

このphaseではUI behaviorを変える必要はない。

### Phase 2: Import and Backfill

bookmark-agentのmapping logicを再利用しつつ、side effectを分割したimporterを作る。

1. Hatena bookmarksをfetchする、またはbookmark-agent export dataを読む。
2. D1 bookmark metadataをupsertする。
3. tagをsyncする。
4. content enrichmentをenqueueする。
5. R2 contentが存在した後にだけAI Search indexingをenqueueする。

import中にMarkdown fetchやAI indexingをinline実行しない。

### Phase 3: D1 Read Path

bookmark list、detail、tag viewをD1 APIへ切り替える。

Hatena dataはdisplay sourceではなくsync metadataにする。

### Phase 4: D1 Write Path and Async Hatena Sync

save/edit/delete flowをD1 write firstへ変更する。

その後にHatena syncをenqueueする。UIには次の状態を表示する:

- `saved`
- `syncing to Hatena`
- `Hatena sync failed`
- `content processing`
- `indexed for search`

### Phase 5: TanStack DB

D1-backed APIの上にTanStack DB collectionを導入する。

最初に入れるもの:

- read-only bookmark collection
- optimistic bookmark creation
- optimistic edit/delete
- refetchまたはpollingによるstatus update

local offline behaviorを一気に置き換えない。新しいwrite pathが安定するまでDexieをbrowser outboxとして残す。

### Phase 6: R2 Content and AI Search

Markdownと抽出テキストをR2に保存する。R2 contentをAI Searchでindexする。検索結果はD1からhydrateする。

consistency checkを追加する:

- D1 bookmarkが存在する。
- R2 contentが存在する。
- AI Search index statusがcontent hashに対して最新である。
- indexing失敗jobが見える。

### Phase 7: bookmark-agent Decommission

次の確認が通った後にbookmark-agent cronを止める:

- D1 countが期待bookmark数と一致する。
- Hatena sync queueに予期しないbacklogがない。
- R2 content coverageが許容範囲にある。
- AI Search coverageが許容範囲にある。
- failed jobが理解済みで、retry可能または意図的に無視できる。

## Data Ownership Rules

- D1 bookmark rowはユーザー表示用bookmark stateのsource of truth。
- R2 objectはraw contentと大きなderived contentのsource of truth。
- AI Searchは派生retrieval index。
- Hatena Bookmarkは外部同期先。
- 既存bookmark-agent dataはmigration sourceであり、継続的なauthorityではない。

## Failure Handling

bookmark creationはD1 writeが成功した時点で成功扱いにする。

下流の失敗は状態を更新する:

- Hatena sync failure: bookmarkは保存済みのまま、sync statusをfailedにする。
- Content fetch failure: bookmarkは保存済みのまま、raw contentなしにする。
- AI generation failure: bookmarkは保存済みのまま、AI outputなしにする。
- AI Search indexing failure: bookmarkは保存済みのまま、semantic searchでは未利用にする。

すべてのfailure pathはD1で可視化し、retry可能にする。

## Security and Privacy

- OAuth tokenをR2に保存しない。
- R2 object keyにsecretを入れない。
- request header、cookie、authorization header、rendered private page contentは、productとして明示的にprivate captureを扱うまで保存しない。
- すべてのD1 queryは `user_id` でscopeする。
- R2 keyは `userId` と `bookmarkId` でscopeする。
- AI Search hitをauthorizationに使わない。必ずD1でhydrateし、authorizeする。

## Open Questions

1. HabuはHatena側で直接編集された内容を定期importするべきか。
2. deduplicationはoriginal URLとcanonical URLのどちらで行うべきか。
3. 生成tagは自動適用するか、まずsuggestionとして保存するか。
4. 大きなcontentはR2 write前にchunkするか、AI Search indexing前だけchunkするか。
5. chatにwrite toolを追加するか、rewriteが安定するまでsearch-onlyのままにするか。

## Implementation Order

1. bookmarks、tags、content pointers、jobs、AI outputs用のD1 schemaを追加する。
2. WranglerにR2とQueue bindingsを追加する。
3. D1-backed bookmark APIsを作る。
4. 既存save UIは残しつつ、write先をD1とHatena sync queueに切り替える。
5. bookmark-agentまたはHatenaからimport/backfillを追加する。
6. content enrichment queueとR2 storageを追加する。
7. AI Search indexingとsearch APIを追加する。
8. TanStack DB collectionsを追加する。
9. UIをHatena-backed readからD1-backed readへ移行する。
10. bookmark-agentをdecommissionする。

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
