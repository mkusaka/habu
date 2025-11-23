"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertCircle, Home, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasHatena, setHasHatena] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check URL params for OAuth result
    const error = searchParams.get("error");
    const success = searchParams.get("success");

    if (error) {
      const errorMessages: Record<string, string> = {
        missing_params: "OAuth parameters missing",
        missing_secret: "OAuth session expired",
        not_authenticated: "Please sign in first",
        oauth_failed: "Hatena connection failed",
      };
      toast.error(errorMessages[error] || "An error occurred");
    }

    if (success === "hatena_connected") {
      toast.success("Successfully connected to Hatena!");
    }

    // Check authentication status
    checkAuthStatus();
  }, [searchParams]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/habu/status", {
        credentials: "include",
      });

      if (response.ok) {
        const status = await response.json() as { authenticated: boolean; hasHatena: boolean };
        setIsAuthenticated(status.authenticated);
        setHasHatena(status.hasHatena);
      }
    } catch (error) {
      console.error("Failed to check auth status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectHatena = () => {
    window.location.href = "/api/habu/oauth/start";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gray-50">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Settings</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/")}
              >
                <Home className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Authentication Status */}
            <div>
              <h3 className="text-sm font-medium mb-2">Usage</h3>
              <p className="text-sm text-muted-foreground mb-3">
                habu works without sign-in. Just connect your Hatena account to start saving bookmarks.
              </p>
            </div>

            <Separator />

            {/* Hatena Connection */}
            <div>
              <h3 className="text-sm font-medium mb-2">Hatena Bookmark</h3>
              <div className="flex items-center gap-2 mb-3">
                {hasHatena ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Connected</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <span className="text-sm">Not connected</span>
                  </>
                )}
              </div>
              {!hasHatena && (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    Connect your Hatena account to save bookmarks.
                  </p>
                  <Button onClick={handleConnectHatena} size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect Hatena
                  </Button>
                </>
              )}
              {hasHatena && (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    Your Hatena account is connected. You can now save bookmarks!
                  </p>
                  <Button
                    onClick={handleConnectHatena}
                    variant="outline"
                    size="sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Reconnect
                  </Button>
                </>
              )}
            </div>

            <Separator />

            {/* App Info */}
            <div>
              <h3 className="text-sm font-medium mb-2">About</h3>
              <p className="text-sm text-muted-foreground">
                habu is a PWA for quickly saving bookmarks to Hatena Bookmark.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-muted-foreground">Loading...</div></div>}>
      <SettingsContent />
    </Suspense>
  );
}
