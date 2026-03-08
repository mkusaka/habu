"use client";

import { useState, useEffect } from "react";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, BellOff } from "lucide-react";

export function NotificationToggle() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const handleToggle = async (checked: boolean) => {
    if (!isSupported) {
      return;
    }

    if (checked && permission !== "granted") {
      setIsRequesting(true);
      try {
        const result = await Notification.requestPermission();
        setPermission(result);
      } catch (error) {
        console.error("Failed to request notification permission:", error);
      } finally {
        setIsRequesting(false);
      }
    }
  };

  // Show skeleton while checking support on client
  if (permission === null) {
    return (
      <Field orientation="horizontal">
        <FieldContent>
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </FieldContent>
        <Skeleton className="h-[1.15rem] w-8 rounded-full" />
      </Field>
    );
  }

  // Not supported - hide completely
  if (!isSupported) {
    return null;
  }

  const isEnabled = permission === "granted";
  const isDenied = permission === "denied";

  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor="notification-toggle" className="items-center">
          {isEnabled ? (
            <Bell className="w-4 h-4 text-muted-foreground" />
          ) : (
            <BellOff className="w-4 h-4 text-muted-foreground" />
          )}
          Error notifications
        </FieldLabel>
        <FieldDescription>
          Receive browser notifications when a queued bookmark fails to save.
        </FieldDescription>
      </FieldContent>
      <div className="flex items-center gap-2">
        {isDenied && <span className="text-xs text-muted-foreground">Blocked in browser</span>}
        <Switch
          id="notification-toggle"
          checked={isEnabled}
          onCheckedChange={handleToggle}
          disabled={isDenied || isRequesting}
        />
      </div>
    </Field>
  );
}
