import { Mastra } from "@mastra/core";
import {
  Observability,
  CloudExporter,
  DefaultExporter,
  SamplingStrategyType,
} from "@mastra/observability";
import { bookmarkSuggestionWorkflow } from "./workflows/bookmark-suggestion";

const isDevelopment = process.env.NEXTJS_ENV === "development";
const accessToken = process.env.MASTRA_CLOUD_ACCESS_TOKEN;

export const mastra = new Mastra({
  workflows: {
    "bookmark-suggestion": bookmarkSuggestionWorkflow,
  },
  observability: new Observability({
    configs: {
      default: {
        serviceName: isDevelopment ? "habu-dev" : "habu",
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: isDevelopment ? [new DefaultExporter()] : [new CloudExporter({ accessToken })],
        requestContextKeys: ["userId", "hatenaId", "url", "gitSha"],
      },
    },
  }),
});
