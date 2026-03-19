import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const { cloudflareTest } = await import("@cloudflare/vitest-pool-workers");

  return {
    plugins: [
      cloudflareTest({
        miniflare: {
          compatibilityDate: "2025-11-23",
          compatibilityFlags: ["nodejs_compat"],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    test: {
      include: ["src/lib/**/*.test.ts", "src/lib/**/*.test.tsx", "src/mcp/**/*.test.ts"],
      exclude: ["src/app/bookmarks/tags/*.test.tsx"],
    },
  };
});
