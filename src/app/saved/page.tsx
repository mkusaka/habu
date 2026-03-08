import { CheckCircle2, Settings } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { getHatenaConnectionStatus } from "@/lib/hatena-status";

export default async function SavedPage() {
  const hasHatena = await getHatenaConnectionStatus();

  return (
    <div className="w-full py-8 text-center">
      <div className="flex justify-center mb-6">
        <CheckCircle2 className="w-16 h-16 text-green-500" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Bookmark Saved!</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Your bookmark has been added to the queue and will be synced to Hatena Bookmark.
      </p>
      <div className="flex flex-col gap-3">
        <LinkButton href="/queue">View Queue</LinkButton>
        <LinkButton href="/" variant="outline">
          Go Home
        </LinkButton>
        {!hasHatena && (
          <LinkButton href="/settings" variant="ghost" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Connect to Hatena
          </LinkButton>
        )}
      </div>
    </div>
  );
}
