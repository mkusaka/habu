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
      const errorMessages: Record<string, { title: string; description?: string }> = {
        missing_params: {
          title: "OAuth parameters missing",
          description: "Please try connecting again.",
        },
        missing_secret: {
          title: "OAuth session expired",
          description: "Please try connecting again.",
        },
        state_missing: {
          title: "OAuth session expired",
          description: "Cookies may have been cleared. Please try again.",
        },
        state_invalid: {
          title: "OAuth session invalid",
          description: "Please try connecting again.",
        },
        token_mismatch: {
          title: "OAuth token mismatch",
          description: "Session may have expired. Please try again.",
        },
        config_error: {
          title: "Server configuration error",
          description: "Please contact the administrator.",
        },
        not_authenticated: {
          title: "Not signed in",
          description: "Please sign in first.",
        },
        oauth_failed: {
          title: "Hatena connection failed",
          description: "This may be a temporary issue. Please try again.",
        },
        verifier_invalid: {
          title: "OAuth verification failed",
          description: "The authorization may have expired. Please try connecting again.",
        },
        token_rejected: {
          title: "OAuth token rejected",
          description: "Please try connecting again.",
        },
        disconnect_failed: {
          title: "Failed to disconnect Hatena",
        },
      };
      const msg = errorMessages[error] || { title: "An error occurred" };
      toast.error(msg.title, { description: msg.description });
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
