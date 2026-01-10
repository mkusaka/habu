"use client";

import { useState, useMemo, useSyncExternalStore, type FormEvent, type ChangeEvent } from "react";
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
import type { McpServerConfig } from "@/lib/mcp-config";
import type { ChatContext } from "@/lib/chat-context";

// Subscribe to localStorage changes for MCP servers
const MCP_SERVERS_KEY = "habu-mcp-servers";
let mcpListeners: Array<() => void> = [];
let mcpCachedServers: McpServerConfig[] = [];
let mcpCachedJson = "";

function subscribeMcp(listener: () => void) {
  mcpListeners = [...mcpListeners, listener];
  return () => {
    mcpListeners = mcpListeners.filter((l) => l !== listener);
  };
}

function getMcpSnapshot(): McpServerConfig[] {
  if (typeof window === "undefined") return mcpCachedServers;
  try {
    const stored = localStorage.getItem(MCP_SERVERS_KEY) ?? "";
    // Return cached value if JSON hasn't changed
    if (stored === mcpCachedJson) {
      return mcpCachedServers;
    }
    mcpCachedJson = stored;
    const all = stored ? (JSON.parse(stored) as McpServerConfig[]) : [];
    mcpCachedServers = all.filter((s) => s.enabled);
    return mcpCachedServers;
  } catch {
    return mcpCachedServers;
  }
}

const emptyMcpServers: McpServerConfig[] = [];
function getMcpServerSnapshot(): McpServerConfig[] {
  return emptyMcpServers;
}

// Listen for storage events to update when MCP servers change
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === MCP_SERVERS_KEY) {
      // Invalidate cache
      mcpCachedJson = "";
      for (const listener of mcpListeners) {
        listener();
      }
    }
  });
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context: ChatContext;
}

// Inner component that handles the chat logic
// This allows us to remount it when context changes
function ChatPanelContent({
  context,
  mcpServers,
}: {
  context: ChatContext;
  mcpServers: McpServerConfig[];
}) {
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/habu/chat",
        body: {
          context,
          mcpServers: mcpServers.map((s) => ({ url: s.url, name: s.name })),
        },
      }),
    [context, mcpServers],
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
  // Use useSyncExternalStore to get MCP servers without causing cascading renders
  const mcpServers = useSyncExternalStore(subscribeMcp, getMcpSnapshot, getMcpServerSnapshot);

  // Generate a key that changes when URL or mcpServers change
  // This forces remount of ChatPanelContent, reinitializing useChat
  // Note: existingComment/existingTags are NOT included to preserve chat history during editing
  const mcpServersKey = mcpServers.map((s) => s.id).join(",");
  const chatKey = useMemo(() => {
    return `${context.url}-${mcpServersKey}`;
  }, [context.url, mcpServersKey]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-0">
          <SheetTitle>Chat about this page</SheetTitle>
          <SheetDescription className="text-xs truncate">
            {context.metadata?.title || context.url}
          </SheetDescription>
        </SheetHeader>

        <ChatPanelContent key={chatKey} context={context} mcpServers={mcpServers} />
      </SheetContent>
    </Sheet>
  );
}
