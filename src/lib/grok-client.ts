export type GrokChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GrokChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
  error?: { message?: string };
};

function getXaiBaseUrl(): string {
  const fromEnv = process.env.XAI_BASE_URL;
  const fromGlobal = (globalThis as unknown as { __XAI_BASE_URL__?: string }).__XAI_BASE_URL__;
  return (fromEnv || fromGlobal || "https://api.x.ai/v1").replace(/\/+$/, "");
}

function getXaiApiKey(): string | undefined {
  const fromEnv = process.env.XAI_API_KEY;
  const fromGlobal = (globalThis as unknown as { __XAI_API_KEY__?: string }).__XAI_API_KEY__;
  return fromEnv || fromGlobal;
}

export function isGrokConfigured(): boolean {
  return !!getXaiApiKey();
}

export async function grokChatCompletionText(params: {
  messages: GrokChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string | null> {
  const apiKey = getXaiApiKey();
  if (!apiKey) return null;

  const fromEnvModel = process.env.XAI_MODEL;
  const fromGlobalModel = (globalThis as unknown as { __XAI_MODEL__?: string }).__XAI_MODEL__;
  const model = params.model || fromEnvModel || fromGlobalModel || "grok-4-1-fast-reasoning";

  const controller = new AbortController();
  const timeoutMs = params.timeoutMs ?? 20000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${getXaiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        temperature: params.temperature ?? 0,
        max_tokens: params.maxTokens ?? 1200,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[Grok] Chat completion failed:", res.status, text.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as GrokChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content : null;
  } catch (error) {
    console.warn("[Grok] Chat completion exception:", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
