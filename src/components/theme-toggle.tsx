"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();
  const selectedTheme = isClient ? (theme ?? "system") : "system";

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label>Theme</Label>
        <p className="text-sm text-muted-foreground">System / Light / Dark</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={selectedTheme === "system" ? "default" : "outline"}
          aria-pressed={selectedTheme === "system"}
          onClick={() => setTheme("system")}
          disabled={!isClient}
        >
          <Monitor className="w-4 h-4" />
          System
        </Button>
        <Button
          type="button"
          size="sm"
          variant={selectedTheme === "light" ? "default" : "outline"}
          aria-pressed={selectedTheme === "light"}
          onClick={() => setTheme("light")}
          disabled={!isClient}
        >
          <Sun className="w-4 h-4" />
          Light
        </Button>
        <Button
          type="button"
          size="sm"
          variant={selectedTheme === "dark" ? "default" : "outline"}
          aria-pressed={selectedTheme === "dark"}
          onClick={() => setTheme("dark")}
          disabled={!isClient}
        >
          <Moon className="w-4 h-4" />
          Dark
        </Button>
      </div>
    </div>
  );
}
