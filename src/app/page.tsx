"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startBackgroundSync } from "@/lib/queue-sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bookmark, List, Settings, Plus } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Start background sync for queue
    startBackgroundSync(30); // Sync every 30 seconds
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Bookmark className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl">habu</CardTitle>
          <p className="text-sm text-muted-foreground">
            Quick bookmark saving to Hatena Bookmark
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => router.push("/share")}
            className="w-full"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Bookmark
          </Button>
          <Button
            onClick={() => router.push("/queue")}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <List className="w-5 h-5 mr-2" />
            View Queue
          </Button>
          <Button
            onClick={() => router.push("/settings")}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <Settings className="w-5 h-5 mr-2" />
            Settings
          </Button>

          <div className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Share any page to habu for quick bookmarking!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
