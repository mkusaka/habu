"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function AutoSaveToggle() {
  const [autoSave, setAutoSave] = useState(false);

  useEffect(() => {
    // Load setting from localStorage
    const saved = localStorage.getItem("habu-auto-save");
    setAutoSave(saved === "true");
  }, []);

  const handleToggle = (checked: boolean) => {
    setAutoSave(checked);
    localStorage.setItem("habu-auto-save", String(checked));
  };

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor="auto-save">Auto-save bookmarks</Label>
        <p className="text-sm text-muted-foreground">
          Automatically save shared URLs without showing the form
        </p>
      </div>
      <Switch
        id="auto-save"
        checked={autoSave}
        onCheckedChange={handleToggle}
      />
    </div>
  );
}
