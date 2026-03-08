"use client";

import { useRef, useState, type KeyboardEvent, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  input: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
  isLoading?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  placeholder?: string;
  className?: string;
}

export function ChatInput({
  input,
  onChange,
  onSubmit,
  disabled,
  isLoading,
  isStreaming,
  onStop,
  placeholder = "Search this page or your bookmarks...",
  className,
}: ChatInputProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      if (input.trim() && !disabled) {
        formRef.current?.requestSubmit();
      }
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border border-border/80 bg-card/95 shadow-lg backdrop-blur",
        className,
      )}
    >
      <form ref={formRef} onSubmit={onSubmit} className="flex items-end gap-3 p-4">
        <Textarea
          value={input}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          className="min-h-24 flex-1 resize-none rounded-2xl border border-border/70 bg-muted/35 px-4 py-3 shadow-none placeholder:text-muted-foreground/85 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        {isStreaming && onStop ? (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            onClick={onStop}
            className="size-11 shrink-0 rounded-full"
            title="Stop generating"
          >
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={disabled || !input.trim()}
            className="size-11 shrink-0 rounded-full"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        )}
      </form>
    </div>
  );
}
