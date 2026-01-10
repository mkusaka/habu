"use client";

import { useState, useMemo, useCallback, type FormEvent, type ChangeEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/habu/chat",
        body: { context },
      }),
    [context],
  );

  const { messages, sendMessage, setMessages, stop, status, error } = useChat({
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";
  const isStreaming = status === "streaming";

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // If editing a message, update it and remove subsequent messages
    if (editingMessageId) {
      const messageIndex = messages.findIndex((m) => m.id === editingMessageId);
      if (messageIndex !== -1) {
        // Keep messages before the edited one, update the edited message
        const newMessages = messages.slice(0, messageIndex);
        setMessages(newMessages);
        setEditingMessageId(null);
        // Send the new message
        sendMessage({ text: input });
        setInput("");
        return;
      }
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

  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopyAll = useCallback(async () => {
    if (messages.length === 0) return;

    // Convert messages to markdown format
    const markdown = messages
      .map((msg) => {
        const role = msg.role === "user" ? "**User**" : "**Assistant**";
        const text =
          msg.parts
            ?.filter((part): part is { type: "text"; text: string } => part.type === "text")
            .map((part) => part.text)
            .join("") || "";
        return `${role}:\n${text}`;
      })
      .join("\n\n---\n\n");

    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedAll(true);
      toast.success("Conversation copied");
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [messages]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      {/* Copy all button */}
      {messages.length > 0 && (
        <div className="px-4 py-2 border-b flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleCopyAll} className="h-7 text-xs gap-1.5">
            {copiedAll ? (
              <>
                <Check className="w-3 h-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy all
              </>
            )}
          </Button>
        </div>
      )}

      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        onEditMessage={handleEditMessage}
        editingMessageId={editingMessageId}
      />

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
        isStreaming={isStreaming}
        onStop={stop}
        isEditing={!!editingMessageId}
        onCancelEdit={handleCancelEdit}
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
