"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Info,
  AlertCircle,
  Copy,
  CheckCircle2,
  Circle,
  XCircle,
} from "lucide-react";

interface GeneratedResult {
  summary?: string;
  tags?: string[];
  formattedComment?: string;
  markdown?: string;
  markdownError?: string;
  metadata?: {
    title?: string;
    description?: string;
    lang?: string;
    ogType?: string;
    siteName?: string;
    keywords?: string;
    author?: string;
  };
  webContext?: string;
}

interface BookmarkEditFormProps {
  bookmarkUrl: string;
  initialComment: string;
  bookmarkedAt?: string;
}

type WorkflowStepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "canceled";

type WorkflowStepState = {
  id: string;
  label: string;
  status: WorkflowStepStatus;
  startedAt?: number;
  endedAt?: number;
};

const WORKFLOW_STEP_ORDER: Array<Pick<WorkflowStepState, "id" | "label">> = [
  { id: "fetch-markdown-and-moderate", label: "Fetch markdown + moderate" },
  { id: "moderate-user-context", label: "Moderate user context" },
  { id: "fetch-metadata", label: "Fetch metadata" },
  { id: "web-search", label: "Web search" },
  { id: "merge-content", label: "Merge content" },
  { id: "generate-summary", label: "Generate summary" },
  { id: "generate-tags", label: "Generate tags" },
  { id: "merge-results", label: "Merge results" },
];

function initWorkflowSteps(): Record<string, WorkflowStepState> {
  return Object.fromEntries(
    WORKFLOW_STEP_ORDER.map((s) => [
      s.id,
      { id: s.id, label: s.label, status: "pending" as const },
    ]),
  );
}

function formatElapsedMs(startedAt?: number, endedAt?: number) {
  if (!startedAt) return "";
  const end = endedAt ?? Date.now();
  const ms = Math.max(0, end - startedAt);
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

async function readSseStream(
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

export function BookmarkEditForm({
  bookmarkUrl,
  initialComment,
  bookmarkedAt,
}: BookmarkEditFormProps) {
  const [comment, setComment] = useState(initialComment);
  const [context, setContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [showRawContent, setShowRawContent] = useState(false);
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(null);
  const [workflowStage, setWorkflowStage] = useState<string | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<Record<string, WorkflowStepState>>(
    initWorkflowSteps(),
  );

  const handleGenerate = async () => {
    if (!bookmarkUrl) {
      toast.error("URL is required");
      return;
    }

    setIsGenerating(true);
    setGeneratedResult(null);
    setWorkflowRunId(null);
    setWorkflowStage("starting");
    setWorkflowSteps(initWorkflowSteps());

    try {
      const response = await fetch("/api/habu/suggest?stream=1", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        credentials: "include",
        body: JSON.stringify({ url: bookmarkUrl, userContext: context || undefined }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Failed to generate");
      }

      if (!response.body) {
        throw new Error("Streaming not supported");
      }

      let gotResult = false;

      await readSseStream(response.body, ({ event, data }) => {
        if (!data) return;

        if (event === "preflight") {
          try {
            const payload = JSON.parse(data) as { stage?: string };
            setWorkflowStage(payload.stage ?? null);
          } catch {
            // ignore
          }
          return;
        }

        if (event === "workflow") {
          try {
            const payload = JSON.parse(data) as {
              type?: string;
              payload?: {
                runId?: string;
                id?: string;
                status?: string;
                startedAt?: number;
                endedAt?: number;
              };
            };

            if (payload.type === "run-created" && payload.payload?.runId) {
              setWorkflowRunId(payload.payload.runId);
              return;
            }

            if (payload.type === "step-start" && payload.payload?.id) {
              const stepId = payload.payload.id;
              setWorkflowSteps((prev) => {
                const existing = prev[stepId];
                if (!existing) return prev;
                return {
                  ...prev,
                  [stepId]: {
                    ...existing,
                    status: "running",
                    startedAt: payload.payload?.startedAt ?? existing.startedAt ?? Date.now(),
                  },
                };
              });
              return;
            }

            if (payload.type === "step-waiting" && payload.payload?.id) {
              const stepId = payload.payload.id;
              setWorkflowSteps((prev) => {
                const existing = prev[stepId];
                if (!existing) return prev;
                return {
                  ...prev,
                  [stepId]: {
                    ...existing,
                    status: "waiting",
                    startedAt: payload.payload?.startedAt ?? existing.startedAt ?? Date.now(),
                  },
                };
              });
              return;
            }

            if (payload.type === "step-result" && payload.payload?.id) {
              const stepId = payload.payload.id;
              const statusRaw = payload.payload.status ?? "success";
              const status: WorkflowStepStatus =
                statusRaw === "failed"
                  ? "failed"
                  : statusRaw === "canceled"
                    ? "canceled"
                    : statusRaw === "waiting"
                      ? "waiting"
                      : "success";

              setWorkflowSteps((prev) => {
                const existing = prev[stepId];
                if (!existing) return prev;
                return {
                  ...prev,
                  [stepId]: {
                    ...existing,
                    status,
                    endedAt: payload.payload?.endedAt ?? existing.endedAt ?? Date.now(),
                  },
                };
              });
              return;
            }
          } catch {
            // ignore
          }
          return;
        }

        if (event === "result") {
          try {
            const payload = JSON.parse(data) as {
              success: boolean;
              error?: string;
              summary?: string;
              tags?: string[];
              formattedComment?: string;
              markdown?: string;
              markdownError?: string;
              metadata?: GeneratedResult["metadata"];
              webContext?: string;
            };
            if (!payload.success) throw new Error(payload.error || "Failed to generate");
            gotResult = true;
            setGeneratedResult({
              summary: payload.summary,
              tags: payload.tags,
              formattedComment: payload.formattedComment,
              markdown: payload.markdown,
              markdownError: payload.markdownError,
              metadata: payload.metadata,
              webContext: payload.webContext,
            });
          } catch (e) {
            toast.error("Generation failed", {
              description: e instanceof Error ? e.message : "Unknown error",
            });
          }
          return;
        }

        if (event === "error") {
          try {
            const payload = JSON.parse(data) as { message?: string };
            toast.error("Generation failed", { description: payload.message || "Unknown error" });
          } catch {
            toast.error("Generation failed");
          }
        }
      });

      if (!gotResult) {
        throw new Error("Failed to generate");
      }
      setWorkflowStage("done");
      toast.success("Generated!", { description: "AI-generated summary and tags are ready." });
    } catch (error) {
      toast.error("Generation failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyGenerated = () => {
    if (generatedResult?.formattedComment) {
      setComment(generatedResult.formattedComment);
      toast.success("Applied generated comment");
    }
  };

  const handleUpdate = async () => {
    if (!bookmarkUrl) {
      toast.error("URL is required");
      return;
    }

    setIsUpdating(true);

    try {
      const response = await fetch("/api/habu/bookmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: bookmarkUrl, comment }),
      });

      const data = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update bookmark");
      }

      toast.success("Bookmark updated!");
    } catch (error) {
      toast.error("Update failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Parse tags from comment
  const extractTags = (commentStr: string): string[] => {
    const tags: string[] = [];
    const tagRegex = /^\[([^\]]+)\]/;
    let remaining = commentStr;
    let match;
    while ((match = tagRegex.exec(remaining)) !== null) {
      tags.push(match[1]);
      remaining = remaining.slice(match[0].length);
    }
    return tags;
  };

  const extractCommentText = (commentStr: string): string => {
    return commentStr.replace(/^(\[[^\]]+\])+/, "").trim();
  };

  const currentTags = extractTags(comment);
  const currentCommentText = extractCommentText(comment);

  return (
    <>
      {/* Workflow Progress */}
      {(isGenerating || workflowStage || workflowRunId) && (
        <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Workflow progress
            </div>
            {isGenerating && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{workflowStage ?? "running"}</span>
              </div>
            )}
          </div>

          {workflowRunId && (
            <div className="text-xs text-muted-foreground">Run ID: {workflowRunId}</div>
          )}

          <div className="grid grid-cols-1 gap-1">
            {WORKFLOW_STEP_ORDER.map(({ id }) => {
              const step = workflowSteps[id];
              if (!step) return null;
              const icon =
                step.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : step.status === "failed" ? (
                  <XCircle className="w-4 h-4 text-red-600" />
                ) : step.status === "running" || step.status === "waiting" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground" />
                );

              return (
                <div key={id} className="flex items-center gap-2">
                  {icon}
                  <span className="flex-1 truncate">{step.label}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {step.status}
                    {step.status !== "pending" && (
                      <span className="ml-2">{formatElapsedMs(step.startedAt, step.endedAt)}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comment Input */}
      <div className="space-y-2">
        <Label htmlFor="comment">Comment</Label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Your comment"
          rows={3}
        />
        {currentTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {currentTags.map((tag, i) => (
              <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                {tag}
              </span>
            ))}
          </div>
        )}
        {currentCommentText && (
          <p className="text-xs text-muted-foreground">{currentCommentText}</p>
        )}
      </div>

      {/* Context Toggle */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowContext(!showContext)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          {showContext ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span>Add context for AI generation</span>
        </button>
        {showContext && (
          <div className="space-y-2">
            <Label htmlFor="context" className="text-sm text-muted-foreground">
              Context (for pages that fail to fetch or need extra info)
            </Label>
            <Textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Paste page content, add notes, or provide context for AI to use..."
              rows={5}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This context will be used when generating summaries and tags. Useful for bot-blocked
              pages or to add supplementary information.
            </p>
          </div>
        )}
      </div>

      {/* Bookmark Info */}
      {bookmarkedAt && (
        <div className="text-xs text-muted-foreground">
          Bookmarked: {new Date(bookmarkedAt).toLocaleString("ja-JP")}
        </div>
      )}

      {/* Generated Result */}
      {generatedResult && (
        <div className="p-3 bg-muted rounded-md space-y-3 text-sm">
          <div>
            <div className="font-medium flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Generated Preview
            </div>
            {generatedResult.tags && generatedResult.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {generatedResult.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {generatedResult.summary && (
              <p className="text-muted-foreground">{generatedResult.summary}</p>
            )}
            {generatedResult.formattedComment && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Formatted comment:</p>
                <code className="text-xs bg-background p-2 rounded block break-all">
                  {generatedResult.formattedComment}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApplyGenerated}
                  className="mt-2 w-full"
                >
                  Apply to Comment
                </Button>
              </div>
            )}
          </div>

          {/* Raw Content Toggle */}
          {(generatedResult.markdown ||
            generatedResult.markdownError ||
            generatedResult.metadata ||
            generatedResult.webContext) && (
            <div className="border-t pt-2">
              <button
                type="button"
                onClick={() => setShowRawContent(!showRawContent)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground w-full"
              >
                {showRawContent ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                <span>Raw content (debug)</span>
              </button>

              {showRawContent && (
                <div className="mt-2 space-y-3">
                  {/* Metadata */}
                  {generatedResult.metadata && Object.keys(generatedResult.metadata).length > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs font-medium mb-1">
                        <div className="flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          Metadata
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              JSON.stringify(generatedResult.metadata, null, 2),
                              "Metadata",
                            )
                          }
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="bg-background p-2 rounded text-xs space-y-1">
                        {generatedResult.metadata.title && (
                          <div>
                            <span className="text-muted-foreground">title:</span>{" "}
                            {generatedResult.metadata.title}
                          </div>
                        )}
                        {generatedResult.metadata.description && (
                          <div>
                            <span className="text-muted-foreground">description:</span>{" "}
                            {generatedResult.metadata.description}
                          </div>
                        )}
                        {generatedResult.metadata.siteName && (
                          <div>
                            <span className="text-muted-foreground">site:</span>{" "}
                            {generatedResult.metadata.siteName}
                          </div>
                        )}
                        {generatedResult.metadata.lang && (
                          <div>
                            <span className="text-muted-foreground">lang:</span>{" "}
                            {generatedResult.metadata.lang}
                          </div>
                        )}
                        {generatedResult.metadata.ogType && (
                          <div>
                            <span className="text-muted-foreground">type:</span>{" "}
                            {generatedResult.metadata.ogType}
                          </div>
                        )}
                        {generatedResult.metadata.keywords && (
                          <div>
                            <span className="text-muted-foreground">keywords:</span>{" "}
                            {generatedResult.metadata.keywords}
                          </div>
                        )}
                        {generatedResult.metadata.author && (
                          <div>
                            <span className="text-muted-foreground">author:</span>{" "}
                            {generatedResult.metadata.author}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Web Context */}
                  {generatedResult.webContext && (
                    <div>
                      <div className="flex items-center justify-between text-xs font-medium mb-1">
                        <div className="flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          Web Search Context
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(generatedResult.webContext!, "Web Context")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <pre className="bg-background p-2 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap break-all">
                        {generatedResult.webContext}
                      </pre>
                    </div>
                  )}

                  {/* Markdown */}
                  {generatedResult.markdown ? (
                    <div>
                      <div className="flex items-center justify-between text-xs font-medium mb-1">
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Markdown ({generatedResult.markdown.length.toLocaleString()} chars)
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(generatedResult.markdown!, "Markdown")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <pre className="bg-background p-2 rounded text-xs overflow-auto whitespace-pre-wrap break-all">
                        {generatedResult.markdown}
                      </pre>
                    </div>
                  ) : generatedResult.markdownError ? (
                    <div>
                      <div className="flex items-center justify-between text-xs font-medium mb-1 text-yellow-600">
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Markdown fetch error
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(generatedResult.markdownError!, "Markdown error")
                          }
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <pre className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded text-xs text-yellow-800 dark:text-yellow-200 overflow-auto max-h-24 whitespace-pre-wrap break-all">
                        {generatedResult.markdownError}
                      </pre>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          variant="outline"
          className="flex-1"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate
            </>
          )}
        </Button>

        <Button onClick={handleUpdate} disabled={isUpdating} className="flex-1" size="lg">
          {isUpdating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            "Update"
          )}
        </Button>
      </div>
    </>
  );
}
