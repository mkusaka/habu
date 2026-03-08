"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";

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
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel>Theme</FieldLabel>
        <FieldDescription>Choose the default appearance for the app.</FieldDescription>
      </FieldContent>
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
    </Field>
  );
}
