"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function SavedPage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect after 2 seconds
    const timer = setTimeout(() => {
      router.push("/queue");
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
      <Card className="w-full text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
          </div>
          <CardTitle>Bookmark Saved!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your bookmark has been added to the queue and will be synced to Hatena Bookmark.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => router.push("/queue")}>
              View Queue
            </Button>
            <Button variant="outline" onClick={() => router.push("/")}>
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
  );
}
