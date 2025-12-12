import { z } from "zod";
import { grokChatCompletionText } from "./grok-client";

const GrokContextOkSchema = z.object({
  ok: z.literal(true),
  webContext: z.string().min(1),
});

const GrokContextNgSchema = z.object({
  ok: z.literal(false),
  reason: z.string().optional(),
});

const GrokContextResponseSchema = z.union([GrokContextOkSchema, GrokContextNgSchema]);

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

export async function fetchGrokWebContext(url: string): Promise<string | undefined> {
  const content = await grokChatCompletionText({
    messages: [
      {
        role: "system",
        content: `<role>
You retrieve external context for a given URL, including related links and surrounding discussion (especially for X/Twitter threads).
</role>

<strict_mode>
If you cannot access relevant primary information about the URL, return ok=false.
Do NOT invent details. Prefer quoting/grounding with short snippets and include URLs when possible.
</strict_mode>

<output_format>
Return ONLY a single JSON object:
{ "ok": true, "webContext": "<text (<= 1200 chars)>" }
or
{ "ok": false, "reason": "..." }
</output_format>`,
      },
      {
        role: "user",
        content: `Get context for this URL. If it's an X/Twitter status URL, focus on: the whole thread outline, what it's about, and any related/linked URLs mentioned or commonly referenced. Keep it concise (<= 1200 chars).\nURL: ${url}`,
      },
    ],
    temperature: 0,
    maxTokens: 1200,
    timeoutMs: 30000,
  });

  if (!content) return undefined;
  const json = extractFirstJsonObject(content);
  if (!json) return undefined;

  try {
    const parsed = GrokContextResponseSchema.parse(JSON.parse(json));
    if (!parsed.ok) return undefined;
    return parsed.webContext.slice(0, 1200);
  } catch (error) {
    console.warn("[Grok] Failed to parse web context JSON:", error);
    return undefined;
  }
}
