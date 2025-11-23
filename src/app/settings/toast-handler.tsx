"use client";

import { useEffect } from "react";
import { toast } from "sonner";

interface ToastHandlerProps {
  error?: string | null;
  success?: string | null;
}

export function ToastHandler({ error, success }: ToastHandlerProps) {
  useEffect(() => {
    if (error) {
      const errorMessages: Record<string, string> = {
        missing_params: "OAuth parameters missing",
        missing_secret: "OAuth session expired",
        not_authenticated: "Please sign in first",
        oauth_failed: "Hatena connection failed",
        disconnect_failed: "Failed to disconnect Hatena",
      };
      toast.error(errorMessages[error] || "An error occurred");
    }

    if (success === "hatena_connected") {
      toast.success("Successfully connected to Hatena!");
    }

    if (success === "hatena_disconnected") {
      toast.success("Successfully disconnected from Hatena");
    }
  }, [error, success]);

  return null;
}
