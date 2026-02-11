const TWITTER_STATUS_PATTERNS = [
  new URLPattern({ hostname: "{:sub.}?twitter.com", pathname: "/:user/status/:id{/*}?" }),
  new URLPattern({ hostname: "{:sub.}?x.com", pathname: "/:user/status/:id{/*}?" }),
] as const;

const TWITTER_PROFILE_PATTERNS = [
  new URLPattern({ hostname: "{:sub.}?twitter.com", pathname: "/:handle{/*}?" }),
  new URLPattern({ hostname: "{:sub.}?x.com", pathname: "/:handle{/*}?" }),
] as const;

export type TwitterStatusMatch = {
  user: string;
  id: string;
};

export function matchTwitterStatusUrl(input: string | URL): TwitterStatusMatch | null {
  const urlString = typeof input === "string" ? input : input.href;

  for (const pattern of TWITTER_STATUS_PATTERNS) {
    const result = pattern.exec(urlString);
    if (!result) continue;

    const { user, id } = result.pathname.groups;
    if (!user || !id || !/^\d+$/.test(id)) continue;

    return { user, id };
  }
  return null;
}

export function isTwitterStatusUrl(input: string | URL): boolean {
  return matchTwitterStatusUrl(input) !== null;
}

export function extractTwitterStatusId(input: string | URL): string | null {
  return matchTwitterStatusUrl(input)?.id ?? null;
}

/** "https://twitter.com/jack" → "@jack" */
export function extractTwitterHandle(authorUrl?: string): string | undefined {
  if (!authorUrl) return undefined;

  for (const pattern of TWITTER_PROFILE_PATTERNS) {
    const result = pattern.exec(authorUrl);
    if (!result) continue;

    const handle = result.pathname.groups.handle;
    if (handle) return `@${handle}`;
  }
  return undefined;
}
