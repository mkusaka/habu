import "@opennextjs/cloudflare";

declare global {
  interface CloudflareEnv {
    NEXTJS_ENV: string;
    BETTER_AUTH_SECRET: string;
    HATENA_CONSUMER_KEY: string;
    HATENA_CONSUMER_SECRET: string;
    DB: D1Database;
    BROWSER_RENDERING_ACCOUNT_ID: string;
    BROWSER_RENDERING_API_TOKEN: string;
    OPENAI_API_KEY: string;
  }
}
