import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Home } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

export default function SettingsLoading() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Settings</CardTitle>
          <LinkButton variant="ghost" size="icon" href="/">
            <Home className="w-5 h-5" />
          </LinkButton>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hatena Connection */}
        <div>
          <h3 className="text-sm font-medium mb-2">Hatena Bookmark</h3>
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="w-5 h-5 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-64 mb-3" />
          <Skeleton className="h-8 w-32" />
        </div>

        <Separator />

        {/* Preferences */}
        <div>
          <h3 className="text-sm font-medium mb-3">Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          </div>
        </div>

        <Separator />

        {/* App Info */}
        <div>
          <h3 className="text-sm font-medium mb-2">About</h3>
          <Skeleton className="h-4 w-72" />
        </div>
      </CardContent>
    </Card>
  );
}
