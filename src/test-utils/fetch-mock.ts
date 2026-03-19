import { expect, vi } from "vitest";

type InterceptPath = string | RegExp;

type PendingInterceptor = {
  origin: string;
  method?: string;
  path: InterceptPath;
  status: number;
  body: BodyInit | null;
  headers?: HeadersInit;
};

const pendingInterceptors: PendingInterceptor[] = [];
let netConnectEnabled = true;

function normalizeBody(body: unknown): BodyInit | null {
  if (body == null) return null;
  if (
    typeof body === "string" ||
    body instanceof ArrayBuffer ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ReadableStream
  ) {
    return body;
  }
  return JSON.stringify(body);
}

function matchesPath(path: InterceptPath, requestPath: string): boolean {
  return typeof path === "string" ? path === requestPath : path.test(requestPath);
}

const mockedFetch = vi.fn(async (input: Request | URL | string, init?: RequestInit) => {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
  );
  const method =
    init?.method ?? (typeof input === "string" || input instanceof URL ? "GET" : input.method);
  const requestPath = `${url.pathname}${url.search}`;

  const interceptIndex = pendingInterceptors.findIndex(
    (interceptor) =>
      interceptor.origin === url.origin &&
      (interceptor.method == null || interceptor.method === method) &&
      matchesPath(interceptor.path, requestPath),
  );

  if (interceptIndex === -1) {
    if (netConnectEnabled) {
      return fetch(input, init);
    }
    throw new Error(`Unexpected fetch: ${method} ${url.toString()}`);
  }

  const [interceptor] = pendingInterceptors.splice(interceptIndex, 1);
  const response = new Response(interceptor.body, {
    status: interceptor.status,
    headers: interceptor.headers,
  });
  Object.defineProperty(response, "url", {
    value: url.toString(),
    configurable: true,
  });
  return response;
});

export const fetchMock = {
  activate() {
    vi.stubGlobal("fetch", mockedFetch);
  },
  deactivate() {
    vi.unstubAllGlobals();
  },
  enableNetConnect() {
    netConnectEnabled = true;
  },
  disableNetConnect() {
    netConnectEnabled = false;
  },
  get(origin: string) {
    return {
      intercept({ path, method }: { path: InterceptPath; method?: string }) {
        return {
          reply(status: number, body: unknown, options?: { headers?: HeadersInit }) {
            pendingInterceptors.push({
              origin,
              method,
              path,
              status,
              body: normalizeBody(body),
              headers: options?.headers,
            });
          },
        };
      },
    };
  },
  assertNoPendingInterceptors() {
    try {
      expect(pendingInterceptors).toHaveLength(0);
    } finally {
      pendingInterceptors.length = 0;
      mockedFetch.mockClear();
    }
  },
  reset() {
    pendingInterceptors.length = 0;
    mockedFetch.mockClear();
    netConnectEnabled = true;
  },
};
