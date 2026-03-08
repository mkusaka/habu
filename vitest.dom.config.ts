import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/app/bookmarks/tags/*.test.tsx", "src/components/chat/*.test.tsx"],
  },
});
