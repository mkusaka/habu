import "@opennextjs/cloudflare";

declare global {
  interface CloudflareEnv {
    NEXTJS_ENV: string;
    BETTER_AUTH_SECRET: string;
    HATENA_CONSUMER_KEY: string;
    HATENA_CONSUMER_SECRET: string;
    DB: D1Database;
    CF_ACCOUNT_ID: string;
    CLOUDFLARE_API_TOKEN: string;
    OPENAI_API_KEY: string;
  }
}
