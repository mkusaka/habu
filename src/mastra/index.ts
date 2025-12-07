import { Mastra } from "@mastra/core";
import { CloudExporter, DefaultExporter, SamplingStrategyType } from "@mastra/core/ai-tracing";
import { bookmarkSuggestionWorkflow } from "./workflows/bookmark-suggestion";

// Cache Mastra instance to avoid re-registering AI Tracing
let cachedMastra: Mastra | null = null;
let cachedAccessToken: string | undefined;

// Get or create Mastra instance
// Caches the instance to prevent "AI Tracing instance 'default' already registered" error
export function getMastra(accessToken?: string): Mastra {
  // Return cached instance if token matches
  if (cachedMastra && cachedAccessToken === accessToken) {
    console.log("[Mastra] Returning cached instance", { hasAccessToken: !!accessToken });
    return cachedMastra;
  }

  const isDevelopment = process.env.NEXTJS_ENV === "development";

  console.log("[Mastra] Creating instance", {
    isDevelopment,
    hasAccessToken: !!accessToken,
  });

  cachedMastra = new Mastra({
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
  cachedAccessToken = accessToken;

  return cachedMastra;
}

export { bookmarkSuggestionWorkflow };
