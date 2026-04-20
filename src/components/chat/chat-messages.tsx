"use client";

import { useEffect, useRef, useState } from "react";
import {
  getToolName,
  isToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai";
import { Streamdown } from "streamdown";
import {
  Bot,
  Bookmark,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileBadge2,
  FileText,
  Hash,
  Loader2,
  Search,
  Sparkles,
  Tag,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { isChatToolSummaryData, type ChatToolSummaryData } from "@/lib/chat-tool-summary";
import { cn } from "@/lib/utils";

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading?: boolean;
  onEditMessage?: (messageId: string, text: string) => void;
  editingMessageId?: string | null;
  editingText?: string;
  onEditingTextChange?: (value: string) => void;
  onSaveEdit?: (messageId: string) => void;
  onCancelEdit?: () => void;
}

interface ChatMessageProps {
  message: UIMessage;
  onEdit?: (messageId: string, text: string) => void;
  isEditing?: boolean;
  editingText?: string;
  onEditingTextChange?: (value: string) => void;
  onSaveEdit?: (messageId: string) => void;
  onCancelEdit?: () => void;
  isLoading?: boolean;
}

interface BookmarkResultItem {
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

type ToolPart = ToolUIPart | DynamicToolUIPart;
type ChatPart = UIMessage["parts"][number];
type SourcePart = Extract<ChatPart, { type: "source-url" | "source-document" }>;
type TextPart = Extract<ChatPart, { type: "text" }>;

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="my-1">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="my-1 pl-4">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="my-1 pl-4">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="my-0.5">{children}</li>,
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-2 overflow-x-auto rounded bg-background/50 p-2 text-xs">{children}</pre>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-background/50 px-1 py-0.5 text-xs">{children}</code>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:no-underline"
    >
      {children}
    </a>
  ),
};

function isTextPart(part: ChatPart): part is TextPart {
  return part.type === "text";
}

function isSourcePart(part: ChatPart): part is SourcePart {
  return part.type === "source-url" || part.type === "source-document";
}

function isChatDataPart(
  part: ChatPart,
): part is { type: `data-${string}`; id?: string; data: unknown } {
  return part.type.startsWith("data-");
}

function hasErrorOutput(output: unknown): output is { error: string } {
  return (
    typeof output === "object" &&
    output !== null &&
    "error" in output &&
    typeof output.error === "string"
  );
}

function isBookmarkResultItem(value: unknown): value is BookmarkResultItem {
  return (
    typeof value === "object" && value !== null && "url" in value && typeof value.url === "string"
  );
}

function isSearchBookmarksResult(value: unknown): value is SearchBookmarksResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "query" in value &&
    typeof value.query === "string" &&
    "total" in value &&
    typeof value.total === "number" &&
    "bookmarks" in value &&
    Array.isArray(value.bookmarks) &&
    value.bookmarks.every(isBookmarkResultItem)
  );
}

function isListBookmarksResult(value: unknown): value is ListBookmarksResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "username" in value &&
    typeof value.username === "string" &&
    "bookmarks" in value &&
    Array.isArray(value.bookmarks) &&
    value.bookmarks.every(isBookmarkResultItem)
  );
}

function isFilterBookmarksResult(value: unknown): value is FilterBookmarksResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "tags" in value &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    "page" in value &&
    typeof value.page === "number" &&
    "username" in value &&
    typeof value.username === "string" &&
    "bookmarks" in value &&
    Array.isArray(value.bookmarks) &&
    value.bookmarks.every(isBookmarkResultItem)
  );
}

function isListTagsResult(value: unknown): value is ListTagsResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "tags" in value &&
    Array.isArray(value.tags) &&
    value.tags.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "tag" in item &&
        typeof item.tag === "string" &&
        "count" in item &&
        typeof item.count === "number",
    )
  );
}

function isBookmarkInfoResult(value: unknown): value is BookmarkInfoResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof value.url === "string" &&
    "comment" in value &&
    typeof value.comment === "string" &&
    "tags" in value &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    "createdAt" in value &&
    typeof value.createdAt === "string"
  );
}

function isFetchMarkdownResult(value: unknown): value is FetchMarkdownResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof value.url === "string" &&
    "markdown" in value &&
    typeof value.markdown === "string"
  );
}

function formatTimestamp(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function truncateText(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text;
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function summarizeToolInput(toolName: string, input: unknown) {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  if ("query" in input && typeof input.query === "string" && input.query.trim()) {
    return `Working on "${input.query}"`;
  }

  if ("url" in input && typeof input.url === "string" && input.url.trim()) {
    return input.url;
  }

  if (toolName === "filter_bookmarks_by_tags" && "tags" in input && Array.isArray(input.tags)) {
    const tags = input.tags.filter((tag): tag is string => typeof tag === "string");
    if (tags.length > 0) {
      return `Filtering by ${tags.join(", ")}`;
    }
  }

  return null;
}

function dedupeSources(parts: SourcePart[]) {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key =
      part.type === "source-url" ? `${part.type}:${part.url}` : `${part.type}:${part.title}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function ChatMessages({
  messages,
  isLoading,
  onEditMessage,
  editingMessageId,
  editingText,
  onEditingTextChange,
  onSaveEdit,
  onCancelEdit,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Empty className="max-w-lg border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>Start a search conversation</EmptyTitle>
            <EmptyDescription>
              Search this page, linked URLs, or your bookmarks. I can also fetch linked pages when
              needed.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-5 p-4">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onEdit={onEditMessage}
            isEditing={editingMessageId === message.id}
            editingText={editingText}
            onEditingTextChange={onEditingTextChange}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            isLoading={isLoading}
          />
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
            <Card className="w-full max-w-2xl gap-0 overflow-hidden py-0">
              <CardHeader className="px-4 py-3">
                <CardTitle className="text-sm">Working through your bookmarks</CardTitle>
                <CardDescription>
                  Gathering sources, bookmark matches, and page context.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2 px-4 pb-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Streaming response...</span>
              </CardContent>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}

function ChatMessage({
  message,
  onEdit,
  isEditing,
  editingText,
  onEditingTextChange,
  onSaveEdit,
  onCancelEdit,
  isLoading,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const parts = message.parts ?? [];
  const sourceParts = dedupeSources(parts.filter(isSourcePart));
  const textContent = parts
    .filter(isTextPart)
    .map((part) => part.text)
    .join("")
    .trim();
  const dataParts = parts.filter(isChatDataPart);
  const toolSummaryParts = dataParts.flatMap((part) =>
    isChatToolSummaryData(part.data)
      ? [{ id: part.id ?? part.data.toolCallId, data: part.data }]
      : [],
  );
  const summarizedToolCallIds = new Set(toolSummaryParts.map((part) => part.data.toolCallId));
  const toolParts = parts
    .filter(isToolUIPart)
    .filter((toolPart) => !summarizedToolCallIds.has(toolPart.toolCallId));
  const genericDataParts = dataParts.filter((part) => !isChatToolSummaryData(part.data));

  const handleEditClick = () => {
    if (isUser && onEdit && textContent) {
      onEdit(message.id, textContent);
    }
  };

  const handleCopy = async () => {
    if (!textContent) {
      return;
    }

    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      toast.success("Copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-muted" : "bg-primary/10",
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4 text-primary" />}
      </div>
      <div className={cn("min-w-0 flex-1 space-y-3", isUser && "flex flex-col items-end")}>
        {!isUser && sourceParts.length > 0 ? <AssistantSources parts={sourceParts} /> : null}

        {!isUser && toolParts.length > 0 ? (
          <div className="space-y-3">
            {toolParts.map((toolPart) => (
              <ToolInvocationDisplay key={toolPart.toolCallId} toolPart={toolPart} />
            ))}
          </div>
        ) : null}

        {!isUser && toolSummaryParts.length > 0 ? (
          <div className="space-y-3">
            {toolSummaryParts.map((part) => (
              <ToolSummaryCard key={part.id} summary={part.data} />
            ))}
          </div>
        ) : null}

        {!isUser && genericDataParts.length > 0 ? (
          <div className="space-y-3">
            {genericDataParts.map((part, index) => (
              <DataPartDisplay
                key={part.id ?? `${part.type}-${index}`}
                label={part.type.replace(/^data-/, "")}
                data={part.data}
              />
            ))}
          </div>
        ) : null}

        {textContent ? (
          isEditing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSaveEdit?.(message.id);
              }}
              className="w-full max-w-full rounded-2xl border border-border/80 bg-card px-3 py-3 shadow-sm"
            >
              <Textarea
                value={editingText ?? textContent}
                onChange={(e) => onEditingTextChange?.(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    onCancelEdit?.();
                    return;
                  }

                  if (e.key === "Enter" && !e.shiftKey && !isComposing) {
                    e.preventDefault();
                    onSaveEdit?.(message.id);
                  }
                }}
                rows={3}
                autoFocus
                disabled={isLoading}
                className="min-h-24 resize-none rounded-xl border border-border/70 bg-muted/35"
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading || !(editingText ?? textContent).trim()}
                >
                  Save
                </Button>
              </div>
            </form>
          ) : isUser ? (
            <div
              className={cn(
                "inline-block max-w-full rounded-2xl bg-primary px-4 py-3 text-left text-sm text-primary-foreground",
                onEdit && "cursor-pointer transition-opacity hover:opacity-90",
              )}
              onClick={handleEditClick}
              onKeyDown={(e) => e.key === "Enter" && handleEditClick()}
              role={onEdit ? "button" : undefined}
              tabIndex={onEdit ? 0 : undefined}
              title={onEdit ? "Click to edit" : undefined}
            >
              <Streamdown
                className="prose prose-sm max-w-none break-words prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                components={markdownComponents}
              >
                {textContent}
              </Streamdown>
            </div>
          ) : (
            <AssistantTextCard text={textContent} copied={copied} onCopy={handleCopy} />
          )
        ) : null}
      </div>
    </div>
  );
}

function AssistantSources({ parts }: { parts: SourcePart[] }) {
  return (
    <Card className="gap-0 overflow-hidden border-dashed py-0">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm">Sources</CardTitle>
        <CardDescription>References gathered while composing this answer.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 px-4 pb-4">
        {parts.map((part) =>
          part.type === "source-url" ? (
            <Badge
              asChild
              key={`${part.sourceId}-${part.url}`}
              variant="secondary"
              className="max-w-full px-3 py-1"
            >
              <a
                href={part.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-2"
              >
                <ExternalLink data-icon="inline-start" />
                <span className="truncate">{part.title || part.url}</span>
              </a>
            </Badge>
          ) : (
            <Badge
              key={`${part.sourceId}-${part.title}`}
              variant="outline"
              className="max-w-full px-3 py-1"
            >
              <FileBadge2 data-icon="inline-start" />
              <span className="truncate">{part.title}</span>
            </Badge>
          ),
        )}
      </CardContent>
    </Card>
  );
}

function AssistantTextCard({
  text,
  copied,
  onCopy,
}: {
  text: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm">Answer</CardTitle>
            <CardDescription>Rendered from the assistant message stream.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="icon" onClick={onCopy} title="Copy message">
            {copied ? <Check className="text-green-600" /> : <Copy />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <Streamdown
          className="prose prose-sm max-w-none break-words dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          components={markdownComponents}
        >
          {text}
        </Streamdown>
      </CardContent>
    </Card>
  );
}

function ToolSummaryCard({ summary }: { summary: ChatToolSummaryData }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-sm">{summary.title}</CardTitle>
            {summary.description ? <CardDescription>{summary.description}</CardDescription> : null}
          </div>
          {typeof summary.durationMs === "number" ? (
            <Badge variant="outline">{`${summary.durationMs}ms`}</Badge>
          ) : null}
        </div>
        {"badges" in summary && summary.badges && summary.badges.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {summary.badges.map((badge) => (
              <Badge key={badge} variant="secondary">
                {badge}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        {summary.kind === "bookmark-results" ? (
          <BookmarkResults title={summary.title} bookmarks={summary.bookmarks} hideHeader />
        ) : null}
        {summary.kind === "tag-results" ? <TagResults tags={summary.tags} hideHeader /> : null}
        {summary.kind === "markdown-preview" ? (
          <MarkdownPreview
            output={{
              url: summary.url,
              markdown: summary.markdown,
              source: summary.source,
            }}
            hideHeader
          />
        ) : null}
        {summary.kind === "tool-error" ? (
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>Tool failed</AlertTitle>
            <AlertDescription>{summary.error}</AlertDescription>
          </Alert>
        ) : null}
        {summary.kind === "tool-json" ? (
          <details className="rounded-2xl border border-border/70 bg-muted/25 p-3 text-sm">
            <summary className="cursor-pointer font-medium">Inspect raw payload</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6">
              {formatJson(summary.value)}
            </pre>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ToolInvocationDisplay({ toolPart }: { toolPart: ToolPart }) {
  const toolName = getToolName(toolPart);
  const state = toolPart.state;
  const toolDisplay = {
    web_search: { icon: Search, label: "Web Search" },
    fetch_markdown: { icon: FileText, label: "Page Markdown" },
    list_bookmarks: { icon: Bookmark, label: "Recent Bookmarks" },
    search_bookmarks: { icon: Search, label: "Bookmark Search" },
    filter_bookmarks_by_tags: { icon: Tag, label: "Tag Filter" },
    list_tags: { icon: Hash, label: "Tag Summary" },
    get_bookmark: { icon: Bookmark, label: "Bookmark Detail" },
    add_bookmark: { icon: Bookmark, label: "Add Bookmark" },
    delete_bookmark: { icon: Trash2, label: "Delete Bookmark" },
    suggest_comment: { icon: Sparkles, label: "Suggest Comment" },
  } as const;

  const { icon: ToolIcon, label: displayName } = toolDisplay[
    toolName as keyof typeof toolDisplay
  ] ?? {
    icon: FileText,
    label: toolName,
  };

  const isRunning =
    state === "input-streaming" ||
    state === "input-available" ||
    state === "approval-requested" ||
    state === "approval-responded";

  const output = state === "output-available" && "output" in toolPart ? toolPart.output : undefined;
  const outputError =
    state === "output-error" || state === "output-denied"
      ? toolPart.errorText
      : output && hasErrorOutput(output)
        ? output.error
        : undefined;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <ToolIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm">{displayName}</CardTitle>
              {isRunning ? (
                <Badge variant="secondary">
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                  Running
                </Badge>
              ) : outputError ? (
                <Badge variant="destructive">
                  <XCircle data-icon="inline-start" />
                  Failed
                </Badge>
              ) : (
                <Badge variant="outline">
                  <CheckCircle2 data-icon="inline-start" />
                  Ready
                </Badge>
              )}
            </div>
            <CardDescription>
              {outputError ||
                summarizeToolInput(toolName, toolPart.input) ||
                "Structured tool step"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        {outputError ? (
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>Tool failed</AlertTitle>
            <AlertDescription>{outputError}</AlertDescription>
          </Alert>
        ) : (
          <ToolResultBody toolName={toolName} output={output} input={toolPart.input} />
        )}
      </CardContent>
    </Card>
  );
}

function ToolResultBody({
  toolName,
  output,
  input,
}: {
  toolName: string;
  output: unknown;
  input: unknown;
}) {
  if (output == null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Waiting for tool output...
      </div>
    );
  }

  if (hasErrorOutput(output)) {
    return (
      <Alert variant="destructive">
        <XCircle />
        <AlertTitle>Tool returned an error</AlertTitle>
        <AlertDescription>{output.error}</AlertDescription>
      </Alert>
    );
  }

  if (toolName === "search_bookmarks" && isSearchBookmarksResult(output)) {
    return (
      <BookmarkResults
        title={`${output.total} saved match${output.total === 1 ? "" : "es"}`}
        description={`Query: ${output.query}`}
        bookmarks={output.bookmarks}
      />
    );
  }

  if (toolName === "list_bookmarks" && isListBookmarksResult(output)) {
    return (
      <BookmarkResults
        title={`${output.bookmarks.length} recent bookmark${output.bookmarks.length === 1 ? "" : "s"}`}
        description={`Account: ${output.username}`}
        bookmarks={output.bookmarks}
      />
    );
  }

  if (toolName === "filter_bookmarks_by_tags" && isFilterBookmarksResult(output)) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {output.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              #{tag}
            </Badge>
          ))}
        </div>
        <BookmarkResults
          title={`${output.bookmarks.length} bookmark${output.bookmarks.length === 1 ? "" : "s"} on page ${output.page}`}
          description={`Account: ${output.username}`}
          bookmarks={output.bookmarks}
        />
      </div>
    );
  }

  if (toolName === "list_tags" && isListTagsResult(output)) {
    return <TagResults tags={output.tags} />;
  }

  if (toolName === "get_bookmark" && isBookmarkInfoResult(output)) {
    return (
      <BookmarkResults
        title="Saved bookmark"
        description={
          typeof input === "object" && input !== null && "url" in input
            ? String(input.url)
            : output.url
        }
        bookmarks={[
          {
            url: output.url,
            comment: output.comment,
            tags: output.tags,
            createdAt: output.createdAt,
          },
        ]}
      />
    );
  }

  if (toolName === "fetch_markdown" && isFetchMarkdownResult(output)) {
    return <MarkdownPreview output={output} />;
  }

  return <DataPartDisplay label={toolName} data={output} />;
}

function BookmarkResults({
  title,
  description,
  bookmarks,
  hideHeader = false,
}: {
  title: string;
  description?: string;
  bookmarks: BookmarkResultItem[];
  hideHeader?: boolean;
}) {
  if (bookmarks.length === 0) {
    return (
      <Alert>
        <Bookmark />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description || "No bookmarks matched this step."}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {!hideHeader ? (
        <div>
          <div className="text-sm font-medium">{title}</div>
          {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
        </div>
      ) : null}
      <div className="space-y-3">
        {bookmarks.map((bookmark, index) => (
          <BookmarkResultRow key={`${bookmark.url}-${index}`} bookmark={bookmark} />
        ))}
      </div>
    </div>
  );
}

function BookmarkResultRow({ bookmark }: { bookmark: BookmarkResultItem }) {
  const dateLabel = formatTimestamp(bookmark.bookmarkedAt || bookmark.createdAt);

  return (
    <article className="space-y-3 rounded-2xl border border-border/70 bg-muted/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 text-sm font-semibold underline-offset-4 hover:underline"
          >
            {bookmark.title || bookmark.url}
          </a>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 break-all">{bookmark.url}</span>
          </div>
        </div>
        {bookmark.isPrivate ? <Badge variant="secondary">Private</Badge> : null}
      </div>

      {bookmark.tags && bookmark.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {bookmark.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              #{tag}
            </Badge>
          ))}
        </div>
      ) : null}

      {bookmark.comment ? <p className="text-sm leading-6">{bookmark.comment}</p> : null}
      {!bookmark.comment && bookmark.snippet ? (
        <p className="text-sm text-muted-foreground">{bookmark.snippet}</p>
      ) : null}

      {dateLabel || typeof bookmark.bookmarkCount === "number" ? (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {dateLabel ? (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" />
              {dateLabel}
            </span>
          ) : null}
          {typeof bookmark.bookmarkCount === "number" ? (
            <span>{bookmark.bookmarkCount} users</span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function TagResults({
  tags,
  hideHeader = false,
}: {
  tags: Array<{ tag: string; count: number }>;
  hideHeader?: boolean;
}) {
  if (tags.length === 0) {
    return (
      <Alert>
        <Hash />
        <AlertTitle>No tags available</AlertTitle>
        <AlertDescription>The account did not return any saved tags.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {!hideHeader ? (
        <div>
          <div className="text-sm font-medium">Top saved tags</div>
          <div className="text-xs text-muted-foreground">
            Showing {tags.length} tags from the connected Hatena account.
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge key={tag.tag} variant="secondary" className="px-3 py-1">
            <span>#{tag.tag}</span>
            <span className="text-muted-foreground">{tag.count}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}

function MarkdownPreview({
  output,
  hideHeader = false,
}: {
  output: FetchMarkdownResult;
  hideHeader?: boolean;
}) {
  return (
    <div className="space-y-3">
      {!hideHeader ? (
        <div>
          <div className="text-sm font-medium">Fetched page content</div>
          <div className="text-xs text-muted-foreground break-all">{output.url}</div>
        </div>
      ) : null}
      {output.source ? (
        <Badge variant="outline" className="px-3 py-1">
          <FileText data-icon="inline-start" />
          {output.source}
        </Badge>
      ) : null}
      <ScrollArea className="max-h-64 rounded-2xl border border-border/70 bg-muted/25">
        <pre className="whitespace-pre-wrap break-words p-4 text-xs leading-6">
          {truncateText(output.markdown, 2400)}
        </pre>
      </ScrollArea>
    </div>
  );
}

function DataPartDisplay({ label, data }: { label: string; data: unknown }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm">{label}</CardTitle>
        <CardDescription>Structured data emitted by the chat response.</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {typeof data === "string" ? (
          <div className="text-sm">{data}</div>
        ) : (
          <details className="rounded-2xl border border-border/70 bg-muted/25 p-3 text-sm">
            <summary className="cursor-pointer font-medium">Inspect raw payload</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6">
              {formatJson(data)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
