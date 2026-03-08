"use client";

import { useState } from "react";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

export function AiGenerateToggle() {
  const [aiGenerate, setAiGenerate] = useState(() => {
    // Initialize state from localStorage (default: false = opt-in)
    if (typeof window === "undefined") return false;
    return localStorage.getItem("habu-ai-generate") === "true";
  });

  const handleToggle = (checked: boolean) => {
    setAiGenerate(checked);
    localStorage.setItem("habu-ai-generate", String(checked));
  };

  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor="ai-generate">AI auto-generation</FieldLabel>
        <FieldDescription>
          Automatically generate summary and tags when saving without a comment.
        </FieldDescription>
      </FieldContent>
      <Switch id="ai-generate" checked={aiGenerate} onCheckedChange={handleToggle} />
    </Field>
  );
}
