import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  // Use wrangler.toml for D1 connection
  // This config is only for generating migrations
  verbose: true,
  strict: true,
});
