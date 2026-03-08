"use client";

import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bookmark, ExternalLink, AlertCircle, Menu } from "lucide-react";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import type { ChatContext } from "@/lib/chat-context";
import type { ChatThreadSummary } from "@/lib/chat-history";
import { SearchPanel } from "./search-panel";

interface ChatPageClientProps {
  sessionId: string;
  initialQuery?: string;
  selectedUrl?: string;
  context: ChatContext;
  initialMessages: UIMessage[];
  historyThreads: ChatThreadSummary[];
  title?: string;
  error?: string;
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
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(
    () => !selectedUrl && !initialQuery && initialMessages.length === 0,
  );
  const [queryInput, setQueryInput] = useState(initialQuery ?? "");
  const [urlInput, setUrlInput] = useState(selectedUrl ?? "");

  const openSearchSession = (params: { query?: string; url?: string; sessionId?: string }) => {
    const normalizedQuery = params.query?.trim() || "";
    const normalizedUrl = params.url?.trim() || "";
    if (!params.sessionId) {
      return;
    }

    const searchParams = new URLSearchParams();
    if (normalizedQuery) searchParams.set("q", normalizedQuery);
    if (normalizedUrl) searchParams.set("url", normalizedUrl);
    setIsSearchPanelOpen(false);
    const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
    router.push(`/search/${params.sessionId}${suffix}`);
  };

  const handleStartSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    openSearchSession({
      sessionId: crypto.randomUUID(),
      query: queryInput,
      url: urlInput,
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSearchPanelOpen((open) => !open)}
          >
            <Menu className="mr-2 h-4 w-4" />
            {isSearchPanelOpen ? "Close Search Menu" : "Open Search Menu"}
          </Button>
          <LinkButton href="/search" variant="outline" size="sm">
            Search Home
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
              Ask about your bookmarks or start from an optional page URL.
            </p>
          )}
        </div>
      </header>

      {isSearchPanelOpen && (
        <div className="border-b bg-muted/20">
          <SearchPanel
            activeSessionId={sessionId}
            queryInput={queryInput}
            urlInput={urlInput}
            historyThreads={historyThreads}
            showQueryInput={false}
            onQueryChange={setQueryInput}
            onUrlChange={setUrlInput}
            onStartSearch={handleStartSearch}
            onOpenSearch={openSearchSession}
          />
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col">
        {error ? (
          <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
            <div className="max-w-md text-center text-sm text-muted-foreground">
              Fix the search inputs in the menu above and try again.
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
