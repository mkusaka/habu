import { Mastra } from "@mastra/core";
import { CloudExporter, DefaultExporter, SamplingStrategyType } from "@mastra/core/ai-tracing";
import { bookmarkSuggestionWorkflow } from "./workflows/bookmark-suggestion";

let mastraInstance: Mastra | null = null;

function createMastra(accessToken?: string): Mastra {
  const isDevelopment = process.env.NEXTJS_ENV === "development";

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

// Get or create Mastra instance with access token from Cloudflare env
export function getMastra(accessToken?: string): Mastra {
  if (!mastraInstance) {
    mastraInstance = createMastra(accessToken);
  }
  return mastraInstance;
}

// For backwards compatibility - will use env var if available
export const mastra = createMastra(process.env.MASTRA_CLOUD_ACCESS_TOKEN);

export { bookmarkSuggestionWorkflow };
