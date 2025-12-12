"use client";

import { CheckCircle2, Circle, FileText, Loader2, XCircle } from "lucide-react";
import type { WorkflowStepState } from "@/lib/mastra-workflow-progress";
import { formatElapsedMs } from "@/lib/mastra-workflow-progress";

export function WorkflowProgress({
  isRunning,
  stage,
  runId,
  steps,
}: {
  isRunning: boolean;
  stage: string | null;
  runId: string | null;
  steps: WorkflowStepState[];
}) {
  return (
    <div className="p-3 bg-muted rounded-md space-y-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Workflow progress
        </div>
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{stage ?? "running"}</span>
          </div>
        )}
      </div>

      {runId && <div className="text-xs text-muted-foreground">Run ID: {runId}</div>}

      <div className="grid grid-cols-1 gap-1">
        {steps.map((step) => {
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
            <div key={step.id} className="flex items-center gap-2">
              {icon}
              <div className="flex-1 min-w-0">
                <div className="truncate">{step.label}</div>
                {step.detail && (
                  <div className="text-xs text-muted-foreground truncate">{step.detail}</div>
                )}
              </div>
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
  );
}
