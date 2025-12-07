import { Mastra } from "@mastra/core";
import { CloudExporter, DefaultExporter, SamplingStrategyType } from "@mastra/core/ai-tracing";
import { bookmarkSuggestionWorkflow } from "./workflows/bookmark-suggestion";

const isDevelopment = process.env.NEXTJS_ENV === "development";

export const mastra = new Mastra({
  workflows: {
    "bookmark-suggestion": bookmarkSuggestionWorkflow,
  },
  observability: {
    configs: {
      default: {
        serviceName: isDevelopment ? "habu-dev" : "habu",
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: isDevelopment
          ? [new DefaultExporter()]
          : [new CloudExporter({ accessToken: process.env.MASTRA_CLOUD_ACCESS_TOKEN })],
      },
    },
  },
});

export { bookmarkSuggestionWorkflow };
