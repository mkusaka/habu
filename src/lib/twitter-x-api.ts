import { isTwitterStatusUrl } from "./twitter-oembed";

type XApiTweet = {
  id?: string;
  text?: string;
  created_at?: string;
  author_id?: string;
  note_tweet?: {
    text?: string;
  };
  article?: {
    plain_text?: string;
  };
};

type XApiTweetResponse = {
  data?: XApiTweet;
};

export type XApiTweetContent = {
  id: string;
  url: string;
  text: string;
  createdAt?: string;
  authorId?: string;
};

function getXBearerToken(): string | undefined {
  const fromEnv = process.env.X_BEARER_TOKEN;
  const fromGlobal = (globalThis as unknown as { __X_BEARER_TOKEN__?: string }).__X_BEARER_TOKEN__;
  return fromEnv || fromGlobal;
}

function extractStatusId(input: string | URL): string | null {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : input;
  } catch {
    return null;
  }
  const match = url.pathname.match(/\/status\/(\d+)/);
  return match?.[1] ?? null;
}

function pickTweetText(data?: XApiTweet): string | null {
  if (!data) return null;
  const articleText = data.article?.plain_text?.trim();
  if (articleText) return articleText;
  const noteText = data.note_tweet?.text?.trim();
  if (noteText) return noteText;
  const text = data.text?.trim();
  return text || null;
}

export async function fetchTwitterStatusViaXApi(
  input: string | URL,
): Promise<XApiTweetContent | null> {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : input;
  } catch {
    return null;
  }

  if (!isTwitterStatusUrl(url)) return null;
  const statusId = extractStatusId(url);
  if (!statusId) return null;

  const token = getXBearerToken();
  if (!token) return null;

  const apiUrl = new URL(`https://api.x.com/2/tweets/${statusId}`);
  apiUrl.searchParams.set("tweet.fields", "note_tweet,article,created_at,author_id,text");

  try {
    const res = await fetch(apiUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[X API] Tweet lookup failed:", res.status, body.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as XApiTweetResponse;
    const text = pickTweetText(data.data);
    if (!text) return null;

    const id = data.data?.id || statusId;
    return {
      id,
      url: url.toString(),
      text,
      createdAt: data.data?.created_at,
      authorId: data.data?.author_id,
    };
  } catch (error) {
    console.warn("[X API] Tweet lookup exception:", error);
    return null;
  }
}

export function formatTwitterStatusMarkdown(data: XApiTweetContent): string {
  const lines: string[] = [];
  lines.push(data.text.trim());
  if (data.createdAt) lines.push(data.createdAt);
  lines.push(data.url);
  return lines.filter(Boolean).join("\n");
}
