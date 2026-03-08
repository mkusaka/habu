import path from "node:path";
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/lib/**/*.test.ts", "src/lib/**/*.test.tsx", "src/mcp/tools/**/*.test.ts"],
    exclude: ["src/app/bookmarks/tags/*.test.tsx"],
    poolOptions: {
      workers: {
        // Avoid depending on `.open-next/*` build outputs during unit tests.
        miniflare: {
          compatibilityDate: "2025-11-23",
          compatibilityFlags: ["nodejs_compat"],
        },
      },
    },
  },
});
