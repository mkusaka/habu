export type WorkflowStepStatus =
  | "pending"
  | "running"
  | "waiting"
  | "success"
  | "failed"
  | "canceled";

export type WorkflowStepState = {
  id: string;
  label: string;
  detail?: string;
  status: WorkflowStepStatus;
  startedAt?: number;
  endedAt?: number;
};

export type WorkflowStepMeta = {
  provider: string;
  model?: string;
  api?: string;
};

export function formatWorkflowStepMeta(meta?: Partial<WorkflowStepMeta>) {
  if (!meta) return undefined;
  const parts = [meta.provider, meta.model, meta.api].filter((p): p is string => !!p);
  if (!parts.length) return undefined;
  return parts.join(" / ");
}

// Static metadata (for non-URL-dependent steps)
export const BOOKMARK_SUGGESTION_STEP_META: Record<string, WorkflowStepMeta> = {
  "moderate-user-context": {
    provider: "OpenAI",
    model: "omni-moderation-latest",
    api: "moderations",
  },
  "fetch-metadata": { provider: "Habu", api: "HTMLRewriter (local)" },
  "merge-content": { provider: "Habu", api: "merge" },
  "generate-summary": { provider: "OpenAI", model: "gpt-5-mini", api: "generate + judge" },
  "generate-tags": { provider: "OpenAI", model: "gpt-5-mini", api: "generate + judge" },
  "merge-results": { provider: "Habu", api: "merge" },
};

// URL-dependent metadata
export const BOOKMARK_SUGGESTION_STEP_META_TWITTER: Record<string, WorkflowStepMeta> = {
  "fetch-markdown-and-moderate": {
    provider: "xAI + OpenAI",
    api: "Grok→oEmbed + omni-moderation-latest",
  },
  "web-search": {
    provider: "xAI",
    model: "grok-3-fast-latest",
    api: "chat/completions",
  },
};

export const BOOKMARK_SUGGESTION_STEP_META_DEFAULT: Record<string, WorkflowStepMeta> = {
  "fetch-markdown-and-moderate": {
    provider: "Cloudflare + OpenAI",
    api: "browser-rendering/markdown + omni-moderation-latest",
  },
  "web-search": {
    provider: "OpenAI",
    model: "gpt-5-mini",
    api: "web_search",
  },
};

export const BOOKMARK_SUGGESTION_STEP_ORDER: Array<Pick<WorkflowStepState, "id" | "label">> = [
  { id: "fetch-markdown-and-moderate", label: "Fetch markdown + moderate" },
  { id: "moderate-user-context", label: "Moderate user context" },
  { id: "fetch-metadata", label: "Fetch metadata" },
  { id: "web-search", label: "Web search" },
  { id: "merge-content", label: "Merge content" },
  { id: "generate-summary", label: "Generate summary" },
  { id: "generate-tags", label: "Generate tags" },
  { id: "merge-results", label: "Merge results" },
];

/** Internal steps that should be hidden from UI */
export const INTERNAL_STEP_IDS = new Set(["merge-content", "merge-results"]);

/** Check if URL is a Twitter/X status URL (simplified check for UI purposes) */
function isTwitterStatusUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const isTwitterHost =
      parsed.hostname === "twitter.com" ||
      parsed.hostname === "www.twitter.com" ||
      parsed.hostname === "x.com" ||
      parsed.hostname === "www.x.com" ||
      parsed.hostname === "mobile.twitter.com" ||
      parsed.hostname === "mobile.x.com";
    // Check for status pattern: /<user>/status/<id>
    return isTwitterHost && /^\/[^/]+\/status\/\d+/.test(parsed.pathname);
  } catch {
    return false;
  }
}

/** Get step metadata based on URL characteristics */
function getStepMeta(stepId: string, url?: string): WorkflowStepMeta | undefined {
  // Check static metadata first
  if (BOOKMARK_SUGGESTION_STEP_META[stepId]) {
    return BOOKMARK_SUGGESTION_STEP_META[stepId];
  }
  // URL-dependent metadata
  const isTwitter = url ? isTwitterStatusUrl(url) : false;
  const urlDependentMeta = isTwitter
    ? BOOKMARK_SUGGESTION_STEP_META_TWITTER
    : BOOKMARK_SUGGESTION_STEP_META_DEFAULT;
  return urlDependentMeta[stepId];
}

export function initBookmarkSuggestionSteps(url?: string): Record<string, WorkflowStepState> {
  return Object.fromEntries(
    BOOKMARK_SUGGESTION_STEP_ORDER.map((s) => [
      s.id,
      {
        id: s.id,
        label: s.label,
        detail: formatWorkflowStepMeta(getStepMeta(s.id, url)),
        status: "pending" as const,
      },
    ]),
  );
}

export interface FilterStepsOptions {
  /** Hide internal steps like merge-content, merge-results */
  hideInternalSteps?: boolean;
  /** Hide moderate-user-context if no user context was provided */
  hasUserContext?: boolean;
}

export function orderedBookmarkSuggestionSteps(
  steps: Record<string, WorkflowStepState>,
  options?: FilterStepsOptions,
): WorkflowStepState[] {
  const { hideInternalSteps = false, hasUserContext = true } = options ?? {};

  return BOOKMARK_SUGGESTION_STEP_ORDER.map(({ id }) => steps[id])
    .filter(Boolean)
    .filter((step) => {
      // Filter out internal steps if requested
      if (hideInternalSteps && INTERNAL_STEP_IDS.has(step.id)) {
        return false;
      }
      // Filter out moderate-user-context if no user context
      if (!hasUserContext && step.id === "moderate-user-context") {
        return false;
      }
      return true;
    });
}

/**
 * Get labels of currently running steps (status === "running" or "waiting")
 * Returns comma-separated list if multiple steps are running in parallel
 */
export function getRunningStepLabels(steps: WorkflowStepState[]): string | null {
  const runningSteps = steps.filter(
    (step) =>
      (step.status === "running" || step.status === "waiting") && !INTERNAL_STEP_IDS.has(step.id),
  );
  if (runningSteps.length === 0) return null;
  return runningSteps.map((step) => step.label).join(", ");
}

export function formatElapsedMs(startedAt?: number, endedAt?: number) {
  if (!startedAt) return "";
  const end = endedAt ?? Date.now();
  const ms = Math.max(0, end - startedAt);
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export async function readSseStream(
  stream: ReadableStream<Uint8Array>,
  onMessage: (msg: { event: string; data: string }) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const boundary = buffer.indexOf("\n\n");
        if (boundary === -1) break;
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const lines = raw.split("\n");
        let event = "message";
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith("event:")) {
            event = line.slice("event:".length).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice("data:".length).trim());
          }
        }
        onMessage({ event, data: dataLines.join("\n") });
      }
    }
  } finally {
    reader.releaseLock();
  }
}
