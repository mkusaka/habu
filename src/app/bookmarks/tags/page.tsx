import { Tags, ArrowLeft } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { TagCleanupManager } from "./tag-cleanup-manager";

export default function BookmarkTagsPage() {
  return (
    <div className="h-full w-full py-8">
      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Tags className="w-6 h-6" />
          <h1 className="text-2xl font-bold tracking-tight">Tag Cleanup</h1>
        </div>
        <LinkButton href="/bookmarks" variant="outline" size="sm" className="w-full sm:w-auto">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Bookmarks
        </LinkButton>
      </header>

      <TagCleanupManager />
    </div>
  );
}
