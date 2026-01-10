"use client";

import { useState, useMemo, type FormEvent, type ChangeEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import type { ChatContext } from "@/lib/chat-context";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context: ChatContext;
}

// Inner component that handles the chat logic
// This allows us to remount it when context changes
function ChatPanelContent({ context }: { context: ChatContext }) {
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/habu/chat",
        body: { context },
      }),
    [context],
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      <ChatMessages messages={messages} isLoading={isLoading} />

      {error && (
        <div className="px-4 py-2 text-sm text-destructive bg-destructive/10">
          Error: {error.message}
        </div>
      )}

      <ChatInput
        input={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        disabled={isLoading}
        isLoading={isLoading}
      />
    </div>
  );
}

export function ChatPanel({ isOpen, onClose, context }: ChatPanelProps) {
  // Generate a key that changes when URL changes
  // This forces remount of ChatPanelContent, reinitializing useChat
  // Note: existingComment/existingTags are NOT included to preserve chat history during editing
  const chatKey = context.url;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-0">
          <SheetTitle>Chat about this page</SheetTitle>
          <SheetDescription className="text-xs truncate">
            {context.metadata?.title || context.url}
          </SheetDescription>
        </SheetHeader>

        <ChatPanelContent key={chatKey} context={context} />
      </SheetContent>
    </Sheet>
  );
}
