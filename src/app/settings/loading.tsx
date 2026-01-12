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
            {/* ThemeToggle: Label + 3 buttons */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-12" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-[74px] rounded-md" />
                <Skeleton className="h-8 w-[62px] rounded-md" />
                <Skeleton className="h-8 w-[60px] rounded-md" />
              </div>
            </div>
            {/* AutoSaveToggle: Label + description + switch */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-64" />
              </div>
              <Skeleton className="h-[1.15rem] w-8 rounded-full" />
            </div>
            {/* AiGenerateToggle: Label + description + switch */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3.5 w-80" />
              </div>
              <Skeleton className="h-[1.15rem] w-8 rounded-full" />
            </div>
            {/* NotificationToggle: icon + label + switch */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="h-3.5 w-28" />
              </div>
              <Skeleton className="h-[1.15rem] w-8 rounded-full" />
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
