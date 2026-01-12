"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-5 w-9 rounded-full" />
      </div>
    );
  }

  // Not supported - hide completely
  if (!isSupported) {
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
