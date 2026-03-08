import OAuth from "oauth-1.0a";
import CryptoJS from "crypto-js";

const HATENA_REQUEST_TOKEN_URL = "https://www.hatena.com/oauth/initiate";
const HATENA_AUTHORIZE_URL = "https://www.hatena.ne.jp/oauth/authorize";
const HATENA_ACCESS_TOKEN_URL = "https://www.hatena.com/oauth/token";
export const HATENA_OAUTH_SCOPE = "read_public,read_private,write_public";

// OAuth 1.0a client setup
// Note: oauth-1.0a library requires synchronous hash_function, so we use CryptoJS
function createOAuthClient(consumerKey: string, consumerSecret: string) {
  return new OAuth({
    consumer: {
      key: consumerKey,
      secret: consumerSecret,
    },
    signature_method: "HMAC-SHA1",
    hash_function(base_string, key) {
      return CryptoJS.HmacSHA1(base_string, key).toString(CryptoJS.enc.Base64);
    },
  });
}

async function exchangeHatenaToken(
  consumerKey: string,
  consumerSecret: string,
  options: {
    url: string;
    data: Record<string, string>;
    token?: OAuth.Token;
    errorMessage: string;
    missingTokenMessage: string;
    logLabel: string;
  },
): Promise<{ oauthToken: string; oauthTokenSecret: string }> {
  const oauth = createOAuthClient(consumerKey, consumerSecret);
  const requestData = {
    url: options.url,
    method: "POST",
    data: options.data,
  };

  // authorize() merges request.data into the result, but the type definition
  // only includes OAuth.Authorization fields. Cast to include our custom data.
  const authorized = oauth.authorize(requestData, options.token) as OAuth.Authorization &
    Record<string, string | undefined>;
  const headerParams = { ...authorized };
  for (const key of Object.keys(options.data)) {
    delete headerParams[key];
  }

  const authHeader = oauth.toHeader(headerParams as OAuth.Authorization);
  const response = await fetch(options.url, {
    method: "POST",
    headers: {
      ...authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(options.data).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Hatena OAuth] ${options.logLabel}:`, errorText);
    throw new Error(
      `${options.errorMessage}: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const text = await response.text();
  const params = new URLSearchParams(text);
  const oauthToken = params.get("oauth_token");
  const oauthTokenSecret = params.get("oauth_token_secret");

  if (!oauthToken || !oauthTokenSecret) {
    throw new Error(options.missingTokenMessage);
  }

  return { oauthToken, oauthTokenSecret };
}

// Get request token from Hatena
export async function getRequestToken(
  callbackUrl: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<{ token: string; tokenSecret: string }> {
  // IMPORTANT: Signature calculation must include ALL parameters that will be sent
  // (oauth_callback + scope). This is OAuth 1.0a spec requirement.
  // Scopes:
  // - read_public: Read public bookmarks
  // - read_private: Read private bookmarks and tags list
  // - write_public: Create/edit bookmarks
  const scope = HATENA_OAUTH_SCOPE;
  const { oauthToken, oauthTokenSecret } = await exchangeHatenaToken(consumerKey, consumerSecret, {
    url: HATENA_REQUEST_TOKEN_URL,
    data: {
      oauth_callback: callbackUrl,
      scope,
    },
    errorMessage: "Failed to get request token",
    missingTokenMessage: "Invalid response from Hatena OAuth: missing token or secret",
    logLabel: "Error Response",
  });

  return { token: oauthToken, tokenSecret: oauthTokenSecret };
}

// Get authorize URL
export function getAuthorizeUrl(token: string): string {
  return `${HATENA_AUTHORIZE_URL}?oauth_token=${encodeURIComponent(token)}`;
}

// Exchange request token for access token
export async function getAccessToken(
  token: string,
  tokenSecret: string,
  verifier: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<{ accessToken: string; accessTokenSecret: string }> {
  // IMPORTANT: oauth_verifier must be included in signature calculation
  // BUT sent only once in the request body (not in Authorization header)
  const { oauthToken, oauthTokenSecret } = await exchangeHatenaToken(consumerKey, consumerSecret, {
    url: HATENA_ACCESS_TOKEN_URL,
    data: {
      oauth_verifier: verifier,
    },
    token: {
      key: token,
      secret: tokenSecret,
    },
    errorMessage: "Failed to get access token",
    missingTokenMessage: "Invalid response from Hatena OAuth: missing access token or secret",
    logLabel: "Access Token Error Response",
  });

  return { accessToken: oauthToken, accessTokenSecret: oauthTokenSecret };
}

// Hatena user info API response type
interface HatenaUserInfo {
  url_name: string;
  display_name?: string;
}

const HATENA_USER_INFO_URL = "https://n.hatena.com/applications/my.json";

// Fetch Hatena user info (url_name = Hatena ID)
export async function fetchHatenaUserInfo(
  accessToken: string,
  accessTokenSecret: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<{ hatenaId: string; displayName?: string }> {
  const oauth = createOAuthClient(consumerKey, consumerSecret);

  const requestData = {
    url: HATENA_USER_INFO_URL,
    method: "GET",
  };

  const headers = oauth.toHeader(
    oauth.authorize(requestData, {
      key: accessToken,
      secret: accessTokenSecret,
    }),
  );

  const response = await fetch(HATENA_USER_INFO_URL, {
    method: "GET",
    headers: { ...headers },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Hatena user info: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as HatenaUserInfo;

  return {
    hatenaId: data.url_name,
    displayName: data.display_name,
  };
}

// Create signed request to Hatena API
export function createSignedRequest(
  url: string,
  method: string,
  accessToken: string,
  accessTokenSecret: string,
  consumerKey: string,
  consumerSecret: string,
  data?: Record<string, string | string[]>,
): Record<string, string> {
  const oauth = createOAuthClient(consumerKey, consumerSecret);

  const requestData = {
    url,
    method,
    data,
  };

  const headers = oauth.toHeader(
    oauth.authorize(requestData, {
      key: accessToken,
      secret: accessTokenSecret,
    }),
  );

  return { ...headers };
}
