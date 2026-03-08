"use client";

import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ArrowLeft,
  Bookmark,
  ExternalLink,
  Home,
  AlertCircle,
  Menu,
  MessageCircle,
  Plus,
} from "lucide-react";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import type { ChatContext } from "@/lib/chat-context";
import type { ChatThreadSummary } from "@/lib/chat-history";
import { cn } from "@/lib/utils";

interface ChatPageClientProps {
  sessionId?: string;
  initialQuery?: string;
  selectedUrl?: string;
  context?: ChatContext;
  initialMessages: UIMessage[];
  historyThreads: ChatThreadSummary[];
  title?: string;
  error?: string;
}

function formatRelativeDate(timestamp: Date): string {
  return timestamp.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

function SearchSidebar({
  sessionId,
  queryInput,
  urlInput,
  historyThreads,
  onQueryChange,
  onUrlChange,
  onStartSearch,
  onOpenSearch,
}: {
  sessionId?: string;
  queryInput: string;
  urlInput: string;
  historyThreads: ChatThreadSummary[];
  onQueryChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onStartSearch: (e: FormEvent<HTMLFormElement>) => void;
  onOpenSearch: (params: { query?: string; url?: string; sessionId?: string }) => void;
}) {
  return (
    <>
      <form onSubmit={onStartSearch} className="space-y-2 border-b p-4">
        <label className="text-xs font-medium text-muted-foreground">Search query</label>
        <Input
          value={queryInput}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="recent AI bookmarks"
          type="text"
        />
        <label className="text-xs font-medium text-muted-foreground">Page URL (optional)</label>
        <Input
          value={urlInput}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://example.com/article"
          type="url"
        />
        <Button type="submit" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Open Search
        </Button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">History</div>
        <div className="space-y-1">
          {historyThreads.length === 0 ? (
            <div className="rounded-md px-3 py-2 text-sm text-muted-foreground">
              No saved conversations yet.
            </div>
          ) : (
            historyThreads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() =>
                  onOpenSearch({
                    sessionId: thread.id,
                    query: thread.query,
                    url: thread.url,
                  })
                }
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent",
                  sessionId === thread.id && "border-primary bg-accent",
                )}
              >
                <div className="truncate text-sm font-medium">
                  {thread.title || thread.query || thread.url || "Untitled Search"}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {thread.lastMessagePreview || thread.query || thread.url || "No preview"}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{thread.messageCount} messages</span>
                  <span>{formatRelativeDate(thread.updatedAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function ChatConversation({
  sessionId,
  context,
  initialMessages,
}: {
  sessionId: string;
  context: ChatContext;
  initialMessages: UIMessage[];
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/habu/chat",
        body: { context },
        prepareSendMessagesRequest: ({ id, messages, trigger, messageId, body }) => {
          if (trigger === "submit-message") {
            return {
              body: {
                ...body,
                id,
                trigger,
                messageId,
                message: messages[messages.length - 1],
              },
            };
          }

          if (trigger === "regenerate-message") {
            return {
              body: {
                ...body,
                id,
                trigger,
                messageId,
              },
            };
          }

          throw new Error(`Unsupported trigger: ${trigger}`);
        },
      }),
    [context],
  );

  const { messages, sendMessage, stop, status, error } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      router.refresh();
    },
  });

  const isLoading = status === "streaming" || status === "submitted";
  const isStreaming = status === "streaming";

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (editingMessageId) {
      const targetMessageId = editingMessageId;
      setEditingMessageId(null);
      sendMessage({ text: input, messageId: targetMessageId });
      setInput("");
      return;
    }

    sendMessage({ text: input });
    setInput("");
  };

  const handleEditMessage = useCallback(
    (messageId: string, text: string) => {
      if (isLoading) return;
      setEditingMessageId(messageId);
      setInput(text);
    },
    [isLoading],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setInput("");
  }, []);

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        onEditMessage={handleEditMessage}
        editingMessageId={editingMessageId}
      />

      {error && (
        <div className="border-t bg-destructive/10 px-4 py-2 text-sm text-destructive">
          Error: {error.message}
        </div>
      )}

      <ChatInput
        input={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        disabled={isLoading}
        isLoading={isLoading}
        isStreaming={isStreaming}
        onStop={stop}
        isEditing={!!editingMessageId}
        onCancelEdit={handleCancelEdit}
      />
    </div>
  );
}

export function ChatPageClient({
  sessionId,
  initialQuery,
  selectedUrl,
  context,
  initialMessages,
  historyThreads,
  title,
  error,
}: ChatPageClientProps) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [queryInput, setQueryInput] = useState(initialQuery ?? "");
  const [urlInput, setUrlInput] = useState(selectedUrl ?? "");

  const openSearch = (params: { query?: string; url?: string; sessionId?: string }) => {
    const normalizedQuery = params.query?.trim() || "";
    const normalizedUrl = params.url?.trim() || "";
    if (!normalizedQuery && !normalizedUrl && !params.sessionId) {
      return;
    }

    const searchParams = new URLSearchParams();
    if (params.sessionId) searchParams.set("session", params.sessionId);
    if (normalizedQuery) searchParams.set("q", normalizedQuery);
    if (normalizedUrl) searchParams.set("url", normalizedUrl);
    setIsSidebarOpen(false);
    router.push(`/search?${searchParams.toString()}`);
  };

  const handleStartChat = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    openSearch({
      sessionId: crypto.randomUUID(),
      query: queryInput,
      url: urlInput,
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <aside className="hidden w-full max-w-xs flex-col border-r bg-muted/20 md:flex">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-medium">Page Search</div>
            <div className="text-xs text-muted-foreground">Persistent search history per URL</div>
          </div>
          <LinkButton href="/" variant="ghost" size="icon">
            <Home className="h-4 w-4" />
          </LinkButton>
        </div>
        <SearchSidebar
          sessionId={sessionId}
          queryInput={queryInput}
          urlInput={urlInput}
          historyThreads={historyThreads}
          onQueryChange={setQueryInput}
          onUrlChange={setUrlInput}
          onStartSearch={handleStartChat}
          onOpenSearch={openSearch}
        />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={() => setIsSidebarOpen((open) => !open)}
            >
              <Menu className="mr-2 h-4 w-4" />
              {isSidebarOpen ? "Close Search Menu" : "Open Search Menu"}
            </Button>
            <LinkButton href="/bookmarks" variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Bookmarks
            </LinkButton>
            {selectedUrl && (
              <LinkButton
                href={`/bookmarks/detail?url=${encodeURIComponent(selectedUrl)}`}
                variant="outline"
                size="sm"
              >
                <Bookmark className="mr-2 h-4 w-4" />
                Open Bookmark Detail
              </LinkButton>
            )}
          </div>
          <div className="mt-3">
            <h1 className="text-xl font-semibold">{title || initialQuery || "Search"}</h1>
            {error ? (
              <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : selectedUrl || initialQuery ? (
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                {initialQuery && <span className="truncate">Query: {initialQuery}</span>}
                {selectedUrl && (
                  <>
                    <span className="truncate">{selectedUrl}</span>
                    <a
                      href={selectedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Page
                    </a>
                  </>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Pick a saved conversation or start a new one from a URL.
              </p>
            )}
          </div>
        </header>

        {isSidebarOpen && (
          <div className="border-b bg-muted/20 md:hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-sm font-medium">Page Search</div>
                <div className="text-xs text-muted-foreground">
                  Persistent search history per URL
                </div>
              </div>
              <LinkButton href="/" variant="ghost" size="icon">
                <Home className="h-4 w-4" />
              </LinkButton>
            </div>
            <SearchSidebar
              sessionId={sessionId}
              queryInput={queryInput}
              urlInput={urlInput}
              historyThreads={historyThreads}
              onQueryChange={setQueryInput}
              onUrlChange={setUrlInput}
              onStartSearch={handleStartChat}
              onOpenSearch={openSearch}
            />
          </div>
        )}

        {!context || !sessionId ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="max-w-md text-center">
              <MessageCircle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <h2 className="text-lg font-medium">Start a page search</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter a URL on the left or open an existing conversation from history.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <ChatConversation
              key={sessionId}
              sessionId={sessionId}
              context={context}
              initialMessages={initialMessages}
            />
          </div>
        )}
      </main>
    </div>
  );
}
