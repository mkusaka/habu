"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bookmark, ExternalLink, AlertCircle, History, Menu, Search } from "lucide-react";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ChatContext } from "@/lib/chat-context";
import type { ChatThreadSummary } from "@/lib/chat-history";
import { SearchPanel } from "./search-panel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { SearchPageShell } from "./search-page-shell";

interface ChatPageClientProps {
  sessionId: string;
  initialQuery?: string;
  initialPrompt?: string;
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
  initialPrompt,
}: {
  sessionId: string;
  context: ChatContext;
  initialMessages: UIMessage[];
  initialPrompt?: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

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

  useEffect(() => {
    if (initialMessages.length > 0 || messages.length > 0 || status !== "ready") {
      return;
    }

    const prompt = initialPrompt?.trim();
    if (!prompt) {
      return;
    }

    sendMessage({ text: prompt });
  }, [initialMessages.length, initialPrompt, messages.length, sendMessage, status]);

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    sendMessage({ text: input });
    setInput("");
  };

  const handleEditMessage = useCallback(
    (messageId: string, text: string) => {
      if (isLoading) return;
      setEditingMessageId(messageId);
      setEditingText(text);
    },
    [isLoading],
  );

  const handleSaveEdit = useCallback(
    (messageId: string) => {
      const nextText = editingText.trim();
      if (!nextText || isLoading) {
        return;
      }

      setEditingMessageId(null);
      setEditingText("");
      sendMessage({ text: nextText, messageId });
    },
    [editingText, isLoading, sendMessage],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingText("");
  }, []);

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {error && (
        <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
          Error: {error.message}
        </div>
      )}

      <div className="min-h-0 flex-1 pb-40 md:pb-32">
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          onEditMessage={handleEditMessage}
          editingMessageId={editingMessageId}
          editingText={editingText}
          onEditingTextChange={setEditingText}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
        />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 px-4 md:bottom-6">
        <div className="mx-auto max-w-4xl">
          <ChatInput
            input={input}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            disabled={isLoading || !!editingMessageId}
            isLoading={isLoading}
            isStreaming={isStreaming}
            onStop={stop}
            placeholder={editingMessageId ? "Finish editing the message above..." : undefined}
          />
        </div>
      </div>
    </div>
  );
}

export function ChatPageClient({
  sessionId,
  initialQuery,
  initialPrompt,
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

  const description = error ? (
    <div className="inline-flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      <span>{error}</span>
    </div>
  ) : selectedUrl ? (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      {selectedUrl ? <span className="break-all">{selectedUrl}</span> : null}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">Ask about your bookmarks.</p>
  );

  return (
    <SearchPageShell
      title={title || initialQuery || "Search"}
      icon={Search}
      description={description}
      bodyClassName="space-y-4"
      actions={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsSearchPanelOpen((open) => !open)}
                aria-label={isSearchPanelOpen ? "Hide search options" : "Show search options"}
              >
                <Menu className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isSearchPanelOpen ? "Hide Search Options" : "Show Search Options"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/search/histories"
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
              >
                <History className="h-4 w-4" />
                <span className="sr-only">Histories</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Histories</TooltipContent>
          </Tooltip>
          {selectedUrl ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={`/bookmarks/detail?url=${encodeURIComponent(selectedUrl)}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                >
                  <Bookmark className="h-4 w-4" />
                  <span className="sr-only">Open Bookmark Detail</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Open Bookmark Detail</TooltipContent>
            </Tooltip>
          ) : null}
          {selectedUrl ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={selectedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                  aria-label="Open Page"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">Open Page</span>
                </a>
              </TooltipTrigger>
              <TooltipContent>Open Page</TooltipContent>
            </Tooltip>
          ) : null}
        </>
      }
    >
      <Card className="min-h-[calc(100dvh-13rem)] gap-0 overflow-hidden py-0">
        {isSearchPanelOpen ? (
          <div className="border-b bg-muted/20">
            <SearchPanel
              activeSessionId={sessionId}
              queryInput={queryInput}
              urlInput={urlInput}
              historyThreads={historyThreads}
              historyTitle="Recent History"
              historyLimit={5}
              showQueryInput={false}
              onQueryChange={setQueryInput}
              onUrlChange={setUrlInput}
              onStartSearch={handleStartSearch}
              onOpenSearch={openSearchSession}
            />
          </div>
        ) : null}

        <main className="flex min-h-0 flex-1 flex-col">
          {error ? (
            <div className="flex flex-1 items-center justify-center px-4 py-8">
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
                initialPrompt={initialPrompt}
              />
            </div>
          )}
        </main>
      </Card>
    </SearchPageShell>
  );
}
