export interface BookmarkResultItem {
  url: string;
  title?: string;
  comment?: string;
  tags?: string[];
  snippet?: string;
  bookmarkedAt?: string;
  createdAt?: string;
  isPrivate?: boolean;
  bookmarkCount?: number;
}

interface SearchBookmarksResult {
  query: string;
  total: number;
  bookmarks: BookmarkResultItem[];
}

interface ListBookmarksResult {
  bookmarks: BookmarkResultItem[];
  username: string;
}

interface FilterBookmarksResult {
  tags: string[];
  page: number;
  bookmarks: BookmarkResultItem[];
  username: string;
}

interface ListTagsResult {
  tags: Array<{ tag: string; count: number }>;
}

interface BookmarkInfoResult {
  url: string;
  comment: string;
  tags: string[];
  createdAt: string;
}

interface FetchMarkdownResult {
  url: string;
  markdown: string;
  source?: string;
}

interface ToolSummaryBase {
  toolCallId: string;
  toolName: string;
  title: string;
  description?: string;
  durationMs?: number;
}

export type ChatToolSummaryData =
  | (ToolSummaryBase & {
      kind: "bookmark-results";
      bookmarks: BookmarkResultItem[];
      badges?: string[];
    })
  | (ToolSummaryBase & {
      kind: "tag-results";
      tags: Array<{ tag: string; count: number }>;
    })
  | (ToolSummaryBase & {
      kind: "markdown-preview";
      url: string;
      markdown: string;
      source?: string;
      badges?: string[];
    })
  | (ToolSummaryBase & {
      kind: "tool-error";
      error: string;
    })
  | (ToolSummaryBase & {
      kind: "tool-json";
      value: unknown;
    });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasErrorOutput(output: unknown): output is { error: string } {
  return isRecord(output) && typeof output.error === "string";
}

function isBookmarkResultItem(value: unknown): value is BookmarkResultItem {
  return isRecord(value) && typeof value.url === "string";
}

function isSearchBookmarksResult(value: unknown): value is SearchBookmarksResult {
  return (
    isRecord(value) &&
    typeof value.query === "string" &&
    typeof value.total === "number" &&
    Array.isArray(value.bookmarks) &&
    value.bookmarks.every(isBookmarkResultItem)
  );
}

function isListBookmarksResult(value: unknown): value is ListBookmarksResult {
  return (
    isRecord(value) &&
    typeof value.username === "string" &&
    Array.isArray(value.bookmarks) &&
    value.bookmarks.every(isBookmarkResultItem)
  );
}

function isFilterBookmarksResult(value: unknown): value is FilterBookmarksResult {
  return (
    isRecord(value) &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    typeof value.page === "number" &&
    typeof value.username === "string" &&
    Array.isArray(value.bookmarks) &&
    value.bookmarks.every(isBookmarkResultItem)
  );
}

function isListTagsResult(value: unknown): value is ListTagsResult {
  return (
    isRecord(value) &&
    Array.isArray(value.tags) &&
    value.tags.every(
      (item) => isRecord(item) && typeof item.tag === "string" && typeof item.count === "number",
    )
  );
}

function isBookmarkInfoResult(value: unknown): value is BookmarkInfoResult {
  return (
    isRecord(value) &&
    typeof value.url === "string" &&
    typeof value.comment === "string" &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    typeof value.createdAt === "string"
  );
}

function isFetchMarkdownResult(value: unknown): value is FetchMarkdownResult {
  return isRecord(value) && typeof value.url === "string" && typeof value.markdown === "string";
}

function summarizeToolInput(input: unknown) {
  if (!isRecord(input)) {
    return undefined;
  }

  if (typeof input.query === "string" && input.query.trim()) {
    return `Query: ${input.query}`;
  }

  if (typeof input.url === "string" && input.url.trim()) {
    return input.url;
  }

  if (Array.isArray(input.tags) && input.tags.every((tag) => typeof tag === "string")) {
    return `Tags: ${input.tags.join(", ")}`;
  }

  return undefined;
}

export function buildChatToolSummary(params: {
  toolCallId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: unknown;
  durationMs?: number;
}): ChatToolSummaryData {
  const base: ToolSummaryBase = {
    toolCallId: params.toolCallId,
    toolName: params.toolName,
    title: params.toolName,
    description: summarizeToolInput(params.input),
    durationMs: params.durationMs,
  };

  if (params.error) {
    return {
      ...base,
      kind: "tool-error",
      title: formatToolTitle(params.toolName),
      error: params.error instanceof Error ? params.error.message : String(params.error),
    };
  }

  if (hasErrorOutput(params.output)) {
    return {
      ...base,
      kind: "tool-error",
      title: formatToolTitle(params.toolName),
      error: params.output.error,
    };
  }

  if (params.toolName === "search_bookmarks" && isSearchBookmarksResult(params.output)) {
    return {
      ...base,
      kind: "bookmark-results",
      title: `${params.output.total} saved match${params.output.total === 1 ? "" : "es"}`,
      description: `Query: ${params.output.query}`,
      bookmarks: params.output.bookmarks,
    };
  }

  if (params.toolName === "list_bookmarks" && isListBookmarksResult(params.output)) {
    return {
      ...base,
      kind: "bookmark-results",
      title: `${params.output.bookmarks.length} recent bookmark${params.output.bookmarks.length === 1 ? "" : "s"}`,
      description: `Account: ${params.output.username}`,
      bookmarks: params.output.bookmarks,
    };
  }

  if (params.toolName === "filter_bookmarks_by_tags" && isFilterBookmarksResult(params.output)) {
    return {
      ...base,
      kind: "bookmark-results",
      title: `${params.output.bookmarks.length} bookmark${params.output.bookmarks.length === 1 ? "" : "s"} on page ${params.output.page}`,
      description: `Account: ${params.output.username}`,
      badges: params.output.tags.map((tag) => `#${tag}`),
      bookmarks: params.output.bookmarks,
    };
  }

  if (params.toolName === "get_bookmark" && isBookmarkInfoResult(params.output)) {
    return {
      ...base,
      kind: "bookmark-results",
      title: "Saved bookmark",
      description: params.output.url,
      bookmarks: [
        {
          url: params.output.url,
          comment: params.output.comment,
          tags: params.output.tags,
          createdAt: params.output.createdAt,
        },
      ],
    };
  }

  if (params.toolName === "list_tags" && isListTagsResult(params.output)) {
    return {
      ...base,
      kind: "tag-results",
      title: "Top saved tags",
      description: `Showing ${params.output.tags.length} tags from the connected Hatena account.`,
      tags: params.output.tags,
    };
  }

  if (params.toolName === "fetch_markdown" && isFetchMarkdownResult(params.output)) {
    return {
      ...base,
      kind: "markdown-preview",
      title: "Fetched page content",
      description: params.output.url,
      url: params.output.url,
      markdown: params.output.markdown,
      source: params.output.source,
      badges: params.output.source ? [params.output.source] : undefined,
    };
  }

  return {
    ...base,
    kind: "tool-json",
    title: formatToolTitle(params.toolName),
    value: params.output ?? null,
  };
}

function formatToolTitle(toolName: string) {
  return toolName
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function isChatToolSummaryData(value: unknown): value is ChatToolSummaryData {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.kind !== "string" || typeof value.toolCallId !== "string") {
    return false;
  }

  switch (value.kind) {
    case "bookmark-results":
      return Array.isArray(value.bookmarks) && value.bookmarks.every(isBookmarkResultItem);
    case "tag-results":
      return isListTagsResult({ tags: value.tags });
    case "markdown-preview":
      return typeof value.url === "string" && typeof value.markdown === "string";
    case "tool-error":
      return typeof value.error === "string";
    case "tool-json":
      return "value" in value;
    default:
      return false;
  }
}
