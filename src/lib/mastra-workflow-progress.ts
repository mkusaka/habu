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
  status: WorkflowStepStatus;
  startedAt?: number;
  endedAt?: number;
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

export function initBookmarkSuggestionSteps(): Record<string, WorkflowStepState> {
  return Object.fromEntries(
    BOOKMARK_SUGGESTION_STEP_ORDER.map((s) => [
      s.id,
      { id: s.id, label: s.label, status: "pending" as const },
    ]),
  );
}

export function orderedBookmarkSuggestionSteps(
  steps: Record<string, WorkflowStepState>,
): WorkflowStepState[] {
  return BOOKMARK_SUGGESTION_STEP_ORDER.map(({ id }) => steps[id]).filter(Boolean);
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
