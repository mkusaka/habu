import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth, MCP_SCOPES } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Bookmark, List, Trash2, Sparkles, AlertTriangle } from "lucide-react";

interface ConsentPageProps {
  searchParams: Promise<{
    client_id?: string;
    redirect_uri?: string;
    response_type?: string;
    scope?: string;
    state?: string;
    code_challenge?: string;
    code_challenge_method?: string;
  }>;
}

// Map scopes to human-readable descriptions
const SCOPE_INFO: Record<
  string,
  { label: string; description: string; icon: React.ComponentType<{ className?: string }> }
> = {
  "bookmark:read": {
    label: "Read Bookmarks",
    description: "View your bookmarks and their details",
    icon: List,
  },
  "bookmark:write": {
    label: "Add Bookmarks",
    description: "Add new bookmarks to your account",
    icon: Bookmark,
  },
  "bookmark:delete": {
    label: "Delete Bookmarks",
    description: "Remove bookmarks from your account",
    icon: Trash2,
  },
  "bookmark:suggest": {
    label: "AI Suggestions",
    description: "Generate AI-powered summaries and tags",
    icon: Sparkles,
  },
  openid: {
    label: "OpenID",
    description: "Access your basic profile information",
    icon: ShieldCheck,
  },
  profile: {
    label: "Profile",
    description: "Access your profile information",
    icon: ShieldCheck,
  },
  email: {
    label: "Email",
    description: "Access your email address",
    icon: ShieldCheck,
  },
  offline_access: {
    label: "Offline Access",
    description: "Access your data when you're not online",
    icon: ShieldCheck,
  },
};

export default async function ConsentPage({ searchParams }: ConsentPageProps) {
  const params = await searchParams;
  const {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    code_challenge,
    code_challenge_method,
  } = params;

  // Validate required parameters
  if (!client_id || !redirect_uri || !scope) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Invalid Request
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Missing required parameters. Please try again from your MCP client.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Check if user is authenticated
  const cookieStore = await cookies();
  const { env } = getCloudflareContext();
  const auth = createAuth(env.DB);

  const session = await auth.api.getSession({
    headers: {
      cookie: cookieStore.toString(),
    },
  });

  // If not authenticated, redirect to login with return URL
  if (!session?.user) {
    const returnUrl = `/mcp/consent?${new URLSearchParams(params as Record<string, string>).toString()}`;
    redirect(`/sign-in?returnTo=${encodeURIComponent(returnUrl)}`);
  }

  // Parse requested scopes
  const requestedScopes = scope.split(" ").filter(Boolean);
  const bookmarkScopes = requestedScopes.filter((s) =>
    MCP_SCOPES.includes(s as (typeof MCP_SCOPES)[number]),
  );

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Authorization Request
        </CardTitle>
        <CardDescription>
          An application is requesting access to your Hatena Bookmark account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Application Info */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <p className="text-sm font-medium">Application</p>
          <p className="text-sm text-muted-foreground font-mono">{client_id}</p>
        </div>

        <Separator />

        {/* Requested Permissions */}
        <div>
          <h3 className="text-sm font-medium mb-3">Requested Permissions</h3>
          <ul className="space-y-3">
            {bookmarkScopes.map((scopeName) => {
              const info = SCOPE_INFO[scopeName];
              if (!info) return null;
              const Icon = info.icon;
              return (
                <li key={scopeName} className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{info.label}</p>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <Separator />

        {/* Action Buttons */}
        <form action="/api/auth/oauth2/consent" method="POST" className="flex gap-3">
          <input type="hidden" name="client_id" value={client_id} />
          <input type="hidden" name="redirect_uri" value={redirect_uri} />
          <input type="hidden" name="response_type" value={response_type || "code"} />
          <input type="hidden" name="scope" value={scope} />
          {state && <input type="hidden" name="state" value={state} />}
          {code_challenge && <input type="hidden" name="code_challenge" value={code_challenge} />}
          {code_challenge_method && (
            <input type="hidden" name="code_challenge_method" value={code_challenge_method} />
          )}

          <Button type="submit" name="accept" value="false" variant="outline" className="flex-1">
            Deny
          </Button>
          <Button type="submit" name="accept" value="true" className="flex-1">
            Allow
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center">
          By clicking Allow, you authorize this application to access your data according to its
          privacy policy.
        </p>
      </CardContent>
    </Card>
  );
}
