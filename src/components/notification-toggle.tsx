"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff } from "lucide-react";

export function NotificationToggle() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleToggle = async (checked: boolean) => {
    if (!("Notification" in window)) {
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

  // Not supported
  if (typeof window === "undefined" || !("Notification" in window)) {
    return null;
  }

  const isEnabled = permission === "granted";
  const isDenied = permission === "denied";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isEnabled ? (
          <Bell className="w-4 h-4 text-muted-foreground" />
        ) : (
          <BellOff className="w-4 h-4 text-muted-foreground" />
        )}
        <Label htmlFor="notification-toggle" className="text-sm">
          Error notifications
        </Label>
      </div>
      <div className="flex items-center gap-2">
        {isDenied && <span className="text-xs text-muted-foreground">Blocked in browser</span>}
        <Switch
          id="notification-toggle"
          checked={isEnabled}
          onCheckedChange={handleToggle}
          disabled={isDenied || isRequesting}
        />
      </div>
    </div>
  );
}
