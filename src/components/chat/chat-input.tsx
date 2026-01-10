"use client";

import { useRef, useState, type KeyboardEvent, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, X } from "lucide-react";

interface ChatInputProps {
  input: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
  isLoading?: boolean;
  isEditing?: boolean;
  onCancelEdit?: () => void;
}

export function ChatInput({
  input,
  onChange,
  onSubmit,
  disabled,
  isLoading,
  isEditing,
  onCancelEdit,
}: ChatInputProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Cancel edit on Escape
    if (e.key === "Escape" && isEditing && onCancelEdit) {
      e.preventDefault();
      onCancelEdit();
      return;
    }
    // Ignore Enter during IME composition
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      if (input.trim() && !disabled) {
        formRef.current?.requestSubmit();
      }
    }
  };

  return (
    <div className="border-t">
      {isEditing && (
        <div className="px-4 pt-2 flex items-center justify-between text-xs text-muted-foreground bg-muted/50">
          <span>Editing message...</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancelEdit}
            className="h-6 px-2 text-xs"
          >
            <X className="w-3 h-3 mr-1" />
            Cancel
          </Button>
        </div>
      )}
      <form ref={formRef} onSubmit={onSubmit} className="flex gap-2 p-4">
        <Textarea
          value={input}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder={isEditing ? "Edit your message..." : "Ask about this page..."}
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
    </div>
  );
}
