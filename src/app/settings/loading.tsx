import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
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
        {/* Hatena Connection - status depends on DB query */}
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

        {/* Preferences - labels are static, only switch states are dynamic */}
        <div>
          <h3 className="text-sm font-medium mb-3">Preferences</h3>
          <div className="space-y-4">
            {/* ThemeToggle */}
            <div className="flex items-center justify-between">
              <Label>Theme</Label>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-[74px] rounded-md" />
                <Skeleton className="h-8 w-[62px] rounded-md" />
                <Skeleton className="h-8 w-[60px] rounded-md" />
              </div>
            </div>
            {/* AutoSaveToggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-save">Auto-save bookmarks</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically save shared URLs without showing the form
                </p>
              </div>
              <Skeleton className="h-[1.15rem] w-8 rounded-full" />
            </div>
            {/* AiGenerateToggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="ai-generate">AI auto-generation</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically generate summary and tags when saving without a comment
                </p>
              </div>
              <Skeleton className="h-[1.15rem] w-8 rounded-full" />
            </div>
            {/* NotificationToggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded" />
                <Label className="text-sm">Error notifications</Label>
              </div>
              <Skeleton className="h-[1.15rem] w-8 rounded-full" />
            </div>
          </div>
        </div>

        <Separator />

        {/* App Info - static */}
        <div>
          <h3 className="text-sm font-medium mb-2">About</h3>
          <p className="text-sm text-muted-foreground">
            habu is a PWA for quickly saving bookmarks to Hatena Bookmark.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
