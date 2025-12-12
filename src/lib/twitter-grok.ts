import { z } from "zod";
import { grokChatCompletionText } from "./grok-client";

const ThreadTweetSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  authorName: z.string().optional(),
  authorHandle: z.string().optional(),
  createdAt: z.string().optional(),
  text: z.string().min(1),
});

const TwitterThreadResultSchema = z.object({
  ok: z.literal(true),
  canonicalUrl: z.string().url().optional(),
  thread: z.array(ThreadTweetSchema).min(1),
  relatedUrls: z.array(z.string().url()).optional(),
});

const TwitterThreadNullSchema = z.object({
  ok: z.literal(false),
  reason: z.string().optional(),
});

const TwitterThreadResponseSchema = z.union([TwitterThreadResultSchema, TwitterThreadNullSchema]);

export type TwitterThreadTweet = z.infer<typeof ThreadTweetSchema>;
export type TwitterThreadData = z.infer<typeof TwitterThreadResultSchema>;

export function extractTwitterStatusId(input: string | URL): string | null {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : input;
  } catch {
    return null;
  }
  const match = url.pathname.match(/\/status\/(\d+)/);
  return match?.[1] ?? null;
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

export async function fetchTwitterThreadViaGrok(
  input: string | URL,
): Promise<TwitterThreadData | null> {
  const statusId = extractTwitterStatusId(input);
  if (!statusId) return null;

  const content = await grokChatCompletionText({
    messages: [
      {
        role: "system",
        content: `<role>
You fetch primary-source Twitter/X thread content.
</role>

<strict_mode>
Return ok=false if you cannot retrieve the actual tweet/thread content.
Do NOT guess, paraphrase, or infer missing text.
Only include tweet text you can retrieve verbatim.
</strict_mode>

<output_format>
Return ONLY a single JSON object matching this schema:
{
  "ok": true,
  "canonicalUrl": "https://x.com/.../status/<id>" | "https://twitter.com/.../status/<id>" (optional),
  "thread": [
    {
      "id": "<tweet id>",
      "url": "<tweet url>",
      "authorName": "<display name>" (optional),
      "authorHandle": "@handle" (optional),
      "createdAt": "<ISO8601 or best-known string>" (optional),
      "text": "<verbatim tweet text>"
    }
  ],
  "relatedUrls": ["https://..."] (optional)
}
or
{ "ok": false, "reason": "..." }
</output_format>`,
      },
      {
        role: "user",
        content: `Fetch the full thread for tweet id ${statusId}. Include the root tweet and all tweets in the same thread (author's thread), ordered oldest->newest. Also extract any URLs mentioned in the thread into relatedUrls.`,
      },
    ],
    temperature: 0,
    maxTokens: 2000,
    timeoutMs: 30000,
  });

  if (!content) return null;
  const json = extractFirstJsonObject(content);
  if (!json) return null;

  try {
    const parsed = TwitterThreadResponseSchema.parse(JSON.parse(json));
    if (!parsed.ok) return null;
    return parsed;
  } catch (error) {
    console.warn("[Grok] Failed to parse twitter thread JSON:", error);
    return null;
  }
}

export function formatTwitterThreadMarkdown(data: TwitterThreadData): string {
  const blocks = data.thread.map((t) => {
    const lines: string[] = [];
    lines.push(t.text.trim());
    const author =
      t.authorName && t.authorHandle
        ? `${t.authorName} (${t.authorHandle})`
        : t.authorName || t.authorHandle;
    if (author) lines.push(`— ${author}`);
    if (t.createdAt) lines.push(t.createdAt);
    lines.push(t.url);
    return lines.filter(Boolean).join("\n");
  });

  const related =
    data.relatedUrls && data.relatedUrls.length
      ? `\n\nLinks:\n${Array.from(new Set(data.relatedUrls)).join("\n")}`
      : "";

  return `${blocks.join("\n\n")}${related}`.trim();
}
