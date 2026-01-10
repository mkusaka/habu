"use client";

import { useRef, useEffect } from "react";
import {
  getToolName,
  isToolUIPart,
  type UIMessage,
  type ToolUIPart,
  type DynamicToolUIPart,
} from "ai";
import { User, Bot, Loader2, Search, FileText, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading?: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-muted-foreground text-sm text-center">
          Ask anything about this page.
          <br />I can help summarize, explain, or suggest bookmark tags.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
      {isLoading && messages[messages.length - 1]?.role === "user" && (
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Thinking...
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

interface ChatMessageProps {
  message: UIMessage;
}

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Extract text content from parts
  const textContent =
    message.parts
      ?.filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("") || "";

  // Extract tool invocations from parts
  const toolParts = message.parts?.filter(isToolUIPart) || [];

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-muted" : "bg-primary/10",
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-primary" />}
      </div>
      <div className={cn("flex-1 space-y-2 overflow-hidden", isUser && "text-right")}>
        {/* Show tool invocations */}
        {toolParts.length > 0 && (
          <div className="space-y-1">
            {toolParts.map((toolPart) => (
              <ToolInvocationDisplay key={toolPart.toolCallId} toolPart={toolPart} />
            ))}
          </div>
        )}
        {textContent && (
          <div
            className={cn(
              "inline-block rounded-lg px-3 py-2 text-sm",
              isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
            )}
          >
            <div className="whitespace-pre-wrap break-words">{textContent}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Type for tool parts returned by isToolUIPart filter
type ToolPart = ToolUIPart | DynamicToolUIPart;

function ToolInvocationDisplay({ toolPart }: { toolPart: ToolPart }) {
  // Use AI SDK helper to extract tool name from the part's type field
  const toolName = getToolName(toolPart);
  const state = toolPart.state;

  // Get appropriate icon for the tool
  const ToolIcon = toolName === "web_search" ? Search : FileText;

  // Get display name for the tool
  const displayName = toolName === "web_search" ? "Web Search" : "Fetch Page";

  // Determine loading state (input streaming or executing)
  const isLoading =
    state === "input-streaming" ||
    state === "input-available" ||
    state === "approval-requested" ||
    state === "approval-responded";

  // Determine error state
  const hasError =
    state === "output-error" ||
    state === "output-denied" ||
    (state === "output-available" &&
      "output" in toolPart &&
      typeof toolPart.output === "object" &&
      toolPart.output !== null &&
      "error" in toolPart.output);

  return (
    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
      <ToolIcon className="w-3 h-3" />
      <span>{displayName}</span>
      {isLoading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : hasError ? (
        <XCircle className="w-3 h-3 text-destructive" />
      ) : (
        <CheckCircle2 className="w-3 h-3 text-green-500" />
      )}
    </div>
  );
}
