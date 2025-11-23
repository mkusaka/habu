import "@opennextjs/cloudflare";

declare global {
  interface CloudflareEnv {
    NEXTJS_ENV: string;
    BETTER_AUTH_SECRET: string;
    HATENA_CONSUMER_KEY: string;
    HATENA_CONSUMER_SECRET: string;
    DB: D1Database;
  }
}
