import { Mastra } from "@mastra/core";
import { CloudExporter, DefaultExporter, SamplingStrategyType } from "@mastra/core/ai-tracing";
import { bookmarkSuggestionWorkflow } from "./workflows/bookmark-suggestion";

// Set telemetry flag before creating Mastra instance
// This suppresses "instrumentation file was not loaded" warning on Cloudflare Workers
// (instrumentation.ts only runs in Node.js runtime, not edge/Workers)
(globalThis as { ___MASTRA_TELEMETRY___?: boolean }).___MASTRA_TELEMETRY___ = true;

const isDevelopment = process.env.NEXTJS_ENV === "development";
const accessToken = process.env.MASTRA_CLOUD_ACCESS_TOKEN;

export const mastra = new Mastra({
  workflows: {
    "bookmark-suggestion": bookmarkSuggestionWorkflow,
  },
  observability: {
    configs: {
      default: {
        serviceName: isDevelopment ? "habu-dev" : "habu",
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: isDevelopment ? [new DefaultExporter()] : [new CloudExporter({ accessToken })],
      },
    },
  },
});
