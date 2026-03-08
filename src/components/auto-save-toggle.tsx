"use client";

import { useState } from "react";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

export function AutoSaveToggle() {
  const [autoSave, setAutoSave] = useState(() => {
    // Initialize state from localStorage
    if (typeof window === "undefined") return false;
    return localStorage.getItem("habu-auto-save") === "true";
  });

  const handleToggle = (checked: boolean) => {
    setAutoSave(checked);
    localStorage.setItem("habu-auto-save", String(checked));
  };

  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor="auto-save">Auto-save bookmarks</FieldLabel>
        <FieldDescription>
          Automatically save shared URLs without showing the form.
        </FieldDescription>
      </FieldContent>
      <Switch id="auto-save" checked={autoSave} onCheckedChange={handleToggle} />
    </Field>
  );
}
