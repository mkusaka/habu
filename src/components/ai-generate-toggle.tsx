"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
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
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor="ai-generate">AI auto-generation</Label>
        <p className="text-sm text-muted-foreground">
          Automatically generate summary and tags when saving without a comment
        </p>
      </div>
      <Switch id="ai-generate" checked={aiGenerate} onCheckedChange={handleToggle} />
    </div>
  );
}
