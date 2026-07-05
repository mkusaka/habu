import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

const betterAuthGlobalSymbol = Symbol.for("better-auth:global");
const HANG = Symbol("better-auth hang");
const AUTH_INIT_TIMEOUT_MS = 10_000;
const SESSION_TIMEOUT_MS = 3_000;
const SESSION_RETRY_TIMEOUT_MS = 5_000;

type WaitUntilContext = Pick<ExecutionContext, "waitUntil">;
type Auth = ReturnType<typeof buildAuth>;
type Session = Awaited<ReturnType<Auth["api"]["getSession"]>>;

interface AuthState {
  auth?: Auth;
  lazyInitAnchored: boolean;
}

const authStates = new WeakMap<D1Database, AuthState>();

function seedBetterAuthAsyncStorage(): void {
  const holder = globalThis as unknown as Record<
    symbol,
    | {
        version: string;
        epoch: number;
        context: Record<string, unknown>;
      }
    | undefined
  >;
  const shared = (holder[betterAuthGlobalSymbol] ??= {
    version: "seed",
    epoch: 0,
    context: {},
  });

  shared.context.requestStateAsyncStorage ??= new AsyncLocalStorage();
  shared.context.endpointContextAsyncStorage ??= new AsyncLocalStorage();
  shared.context.adapterAsyncStorage ??= new AsyncLocalStorage();
}

seedBetterAuthAsyncStorage();

function buildAuth(db: D1Database) {
  return betterAuth({
    database: drizzleAdapter(getDb(db), {
      provider: "sqlite",
      schema: {
        // Map plural table exports to Better Auth's expected singular model names
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),

    secret: process.env.BETTER_AUTH_SECRET || "change-this-secret-in-production",

    // Configure session
    session: {
      storeSessionInDatabase: true,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
        strategy: "jwe", // Use JWE for encrypted session cookies
        refreshCache: true,
      },
    },

    plugins: [
      anonymous(),
      nextCookies(), // Must be last plugin - handles cookie setting in Next.js
    ],

    // Account settings
    account: {
      accountLinking: {
        enabled: true,
      },
    },

    // Trust the host header for Cloudflare Workers
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
      crossSubDomainCookies: {
        enabled: false,
      },
    },
  });
}

function getAuthState(db: D1Database): AuthState {
  const state = authStates.get(db);
  if (state) {
    return state;
  }

  const nextState: AuthState = { lazyInitAnchored: false };
  authStates.set(db, nextState);
  return nextState;
}

// Create auth instance with database
// For Cloudflare Workers, this should be called with the D1 binding from env
export function createAuth(db: D1Database, ctx?: WaitUntilContext) {
  const state = getAuthState(db);
  state.auth ??= buildAuth(db);
  if (ctx) {
    anchorAuthInit(db, ctx);
  }
  return state.auth;
}

function anchorAuthInit(db: D1Database, ctx: WaitUntilContext): void {
  const state = getAuthState(db);
  if (state.lazyInitAnchored) {
    return;
  }

  state.lazyInitAnchored = true;
  ctx.waitUntil(
    initAuthLazyState(db, state).catch((error) => {
      state.lazyInitAnchored = false;
      console.warn("better_auth_lazy_init_failed", error);
    }),
  );
}

async function initAuthLazyState(db: D1Database, state: AuthState): Promise<void> {
  const auth = createAuth(db);
  const contextPromise = (auth as unknown as { $context?: Promise<unknown> }).$context;
  if (!contextPromise) {
    return;
  }

  const ready = await raceHang(contextPromise, AUTH_INIT_TIMEOUT_MS);
  if (ready === HANG) {
    if (state.auth === auth) {
      state.auth = undefined;
    }
    throw new Error("better-auth lazy init hang");
  }
}

async function raceHang<T>(promise: Promise<T>, ms: number): Promise<T | typeof HANG> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof HANG>((resolve) => {
    timer = setTimeout(() => resolve(HANG), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
    promise.catch(() => {});
  }
}

export async function getSessionWithRecovery(
  db: D1Database,
  headers: Headers | Record<string, string>,
  ctx?: WaitUntilContext,
): Promise<Session | null> {
  const state = getAuthState(db);
  const auth = createAuth(db, ctx);
  const first = await raceHang(auth.api.getSession({ headers }), SESSION_TIMEOUT_MS);
  if (first !== HANG) {
    return first;
  }

  if (state.auth === auth) {
    state.auth = undefined;
    state.lazyInitAnchored = false;
  }

  const fresh = createAuth(db, ctx);
  const second = await raceHang(fresh.api.getSession({ headers }), SESSION_RETRY_TIMEOUT_MS);
  const recovered = second !== HANG;
  console.warn("better_auth_session_hang", { recovered });

  if (recovered) {
    return second;
  }

  if (state.auth === fresh) {
    state.auth = undefined;
    state.lazyInitAnchored = false;
  }

  return null;
}
