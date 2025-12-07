import { Mastra } from "@mastra/core";
import { CloudExporter, DefaultExporter, SamplingStrategyType } from "@mastra/core/ai-tracing";
import { bookmarkSuggestionWorkflow } from "./workflows/bookmark-suggestion";

// Create Mastra instance on every call
// This ensures the access token from Cloudflare env is always used
export function getMastra(accessToken?: string): Mastra {
  const isDevelopment = process.env.NEXTJS_ENV === "development";

  console.log("[Mastra] Creating instance", {
    isDevelopment,
    hasAccessToken: !!accessToken,
  });

  return new Mastra({
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
}

export { bookmarkSuggestionWorkflow };
