"use client";

import { useRef, type KeyboardEvent, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  input: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function ChatInput({ input, onChange, onSubmit, disabled, isLoading }: ChatInputProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !disabled) {
        formRef.current?.requestSubmit();
      }
    }
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex gap-2 p-4 border-t">
      <Textarea
        value={input}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder="Ask about this page..."
        disabled={disabled}
        rows={2}
        className="resize-none flex-1"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !input.trim()}
        className="shrink-0 h-auto"
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </Button>
    </form>
  );
}
