"use client";

import { useRef, useEffect, useState } from "react";
import {
  getToolName,
  isToolUIPart,
  type UIMessage,
  type ToolUIPart,
  type DynamicToolUIPart,
} from "ai";
import { Streamdown } from "streamdown";
import {
  User,
  Bot,
  Loader2,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading?: boolean;
  onEditMessage?: (messageId: string, text: string) => void;
  editingMessageId?: string | null;
}

export function ChatMessages({
  messages,
  isLoading,
  onEditMessage,
  editingMessageId,
}: ChatMessagesProps) {
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
        <ChatMessage
          key={message.id}
          message={message}
          onEdit={onEditMessage}
          isEditing={editingMessageId === message.id}
        />
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
  onEdit?: (messageId: string, text: string) => void;
  isEditing?: boolean;
}

// Shared markdown component configuration
const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="my-1">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="my-1 pl-4">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="my-1 pl-4">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="my-0.5">{children}</li>,
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-2 p-2 rounded bg-background/50 overflow-x-auto text-xs">{children}</pre>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="px-1 py-0.5 rounded bg-background/50 text-xs">{children}</code>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline hover:no-underline"
    >
      {children}
    </a>
  ),
};

function ChatMessage({ message, onEdit, isEditing }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  // Extract text content from parts
  const textContent =
    message.parts
      ?.filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("") || "";

  // Extract tool invocations from parts
  const toolParts = message.parts?.filter(isToolUIPart) || [];

  const handleEditClick = () => {
    if (isUser && onEdit && textContent) {
      onEdit(message.id, textContent);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!textContent) return;
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
    <div className={cn("flex items-start gap-3 group", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-muted" : "bg-primary/10",
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-primary" />}
      </div>
      <div className={cn("flex-1 space-y-2 overflow-hidden", isUser && "flex flex-col items-end")}>
        {/* Show tool invocations */}
        {toolParts.length > 0 && (
          <div className="space-y-1 w-full">
            {toolParts.map((toolPart) => (
              <ToolInvocationDisplay key={toolPart.toolCallId} toolPart={toolPart} />
            ))}
          </div>
        )}
        {textContent && (
          <div className="relative">
            <div
              className={cn(
                "inline-block rounded-lg px-3 py-2 text-sm max-w-full text-left",
                isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                isUser && onEdit && "cursor-pointer hover:opacity-90 transition-opacity",
                isEditing && "ring-2 ring-ring ring-offset-2 ring-offset-background",
              )}
              onClick={handleEditClick}
              onKeyDown={(e) => e.key === "Enter" && handleEditClick()}
              role={isUser && onEdit ? "button" : undefined}
              tabIndex={isUser && onEdit ? 0 : undefined}
              title={isUser && onEdit ? "Click to edit" : undefined}
            >
              <Streamdown
                className={cn(
                  "prose prose-sm max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                  isUser ? "prose-invert" : "dark:prose-invert",
                )}
                components={markdownComponents}
              >
                {textContent}
              </Streamdown>
            </div>
            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                "absolute -bottom-1 opacity-0 group-hover:opacity-100 transition-opacity",
                "p-1 rounded bg-background border shadow-sm hover:bg-muted",
                isUser ? "left-0 translate-x-0" : "right-0 translate-x-0",
              )}
              title="Copy message"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 text-muted-foreground" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Type for tool parts returned by isToolUIPart filter
type ToolPart = ToolUIPart | DynamicToolUIPart;

function ToolInvocationDisplay({ toolPart }: { toolPart: ToolPart }) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  // Get tool result for display
  const hasResult = state === "output-available" && "output" in toolPart;
  const toolResult = hasResult ? toolPart.output : null;

  // Format result for display
  const formatResult = () => {
    if (!toolResult) return null;
    if (typeof toolResult === "string") return toolResult;
    if (typeof toolResult === "object") {
      // Handle fetch_markdown result
      if ("markdown" in toolResult && typeof toolResult.markdown === "string") {
        const markdown = toolResult.markdown as string;
        // Truncate long markdown
        return markdown.length > 2000
          ? markdown.slice(0, 2000) + "\n\n[...truncated...]"
          : markdown;
      }
      // Handle error result
      if ("error" in toolResult) {
        return `Error: ${toolResult.error}`;
      }
      // Generic object
      return JSON.stringify(toolResult, null, 2);
    }
    return String(toolResult);
  };

  const resultText = formatResult();
  const canExpand = hasResult && resultText && !hasError;

  return (
    <div className="text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        disabled={!canExpand}
        className={cn(
          "inline-flex items-center gap-2 bg-muted/50 rounded px-2 py-1",
          canExpand && "cursor-pointer hover:bg-muted/70",
        )}
      >
        {canExpand &&
          (isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
        <ToolIcon className="w-3 h-3" />
        <span>{displayName}</span>
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : hasError ? (
          <XCircle className="w-3 h-3 text-destructive" />
        ) : (
          <CheckCircle2 className="w-3 h-3 text-green-500" />
        )}
      </button>
      {isExpanded && resultText && (
        <div className="mt-1 p-2 bg-muted/30 rounded border border-border/50 max-h-64 overflow-auto">
          <pre className="whitespace-pre-wrap break-words text-xs font-mono">{resultText}</pre>
        </div>
      )}
    </div>
  );
}
