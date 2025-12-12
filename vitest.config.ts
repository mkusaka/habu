import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
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
