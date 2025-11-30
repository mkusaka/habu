import OAuth from "oauth-1.0a";
import CryptoJS from "crypto-js";

const HATENA_REQUEST_TOKEN_URL = "https://www.hatena.com/oauth/initiate";
const HATENA_AUTHORIZE_URL = "https://www.hatena.ne.jp/oauth/authorize";
const HATENA_ACCESS_TOKEN_URL = "https://www.hatena.com/oauth/token";

// OAuth 1.0a client setup
// Note: oauth-1.0a library requires synchronous hash_function, so we use CryptoJS
// TODO: Consider switching to a library that supports async crypto or implement custom OAuth
function createOAuthClient() {
  return new OAuth({
    consumer: {
      key: process.env.HATENA_CONSUMER_KEY!,
      secret: process.env.HATENA_CONSUMER_SECRET!,
    },
    signature_method: "HMAC-SHA1",
    hash_function(base_string, key) {
      return CryptoJS.HmacSHA1(base_string, key).toString(CryptoJS.enc.Base64);
    },
  });
}

// Get request token from Hatena
export async function getRequestToken(
  callbackUrl: string,
): Promise<{ token: string; tokenSecret: string }> {
  const oauth = createOAuthClient();

  // IMPORTANT: Signature calculation must include ALL parameters that will be sent
  // (oauth_callback + scope). This is OAuth 1.0a spec requirement.
  // Scopes:
  // - read_public: Read public bookmarks
  // - read_private: Read private bookmarks and tags list
  // - write_public: Create/edit public bookmarks
  const scope = "read_public,read_private,write_public";
  const requestData = {
    url: HATENA_REQUEST_TOKEN_URL,
    method: "POST",
    data: {
      oauth_callback: callbackUrl,
      scope,
    },
  };

  const authorized = oauth.authorize(requestData);

  // Remove scope from Authorization header to avoid double-sending
  // (same pattern as oauth_verifier in access token exchange)
  const headerParams = { ...authorized };
  if ("scope" in headerParams) {
    delete (headerParams as { scope?: string }).scope;
  }
  const authHeader = oauth.toHeader(headerParams);

  // Send scope in the request body only
  // Scope is critical for Hatena - without it, you can't access bookmark API
  const bodyParams = new URLSearchParams({ scope });

  const response = await fetch(HATENA_REQUEST_TOKEN_URL, {
    method: "POST",
    headers: {
      ...authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Hatena OAuth] Error Response:", errorText);
    throw new Error(
      `Failed to get request token: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const text = await response.text();
  const params = new URLSearchParams(text);

  const token = params.get("oauth_token");
  const tokenSecret = params.get("oauth_token_secret");

  if (!token || !tokenSecret) {
    throw new Error("Invalid response from Hatena OAuth: missing token or secret");
  }

  return { token, tokenSecret };
}

// Get authorize URL
export function getAuthorizeUrl(token: string): string {
  return `${HATENA_AUTHORIZE_URL}?oauth_token=${token}`;
}

// Exchange request token for access token
export async function getAccessToken(
  token: string,
  tokenSecret: string,
  verifier: string,
): Promise<{ accessToken: string; accessTokenSecret: string }> {
  const oauth = createOAuthClient();

  // IMPORTANT: oauth_verifier must be included in signature calculation
  // BUT sent only once in the request body (not in Authorization header)
  const requestData = {
    url: HATENA_ACCESS_TOKEN_URL,
    method: "POST",
    data: {
      oauth_verifier: verifier,
    },
  };

  const authorized = oauth.authorize(requestData, { key: token, secret: tokenSecret });

  // Remove oauth_verifier from Authorization header to avoid double-sending
  // We need to remove it manually since toHeader() includes all data params
  const headerParams = { ...authorized };
  if ("oauth_verifier" in headerParams) {
    delete (headerParams as { oauth_verifier?: string }).oauth_verifier;
  }
  const authHeader = oauth.toHeader(headerParams);

  // Send oauth_verifier only in POST body
  const bodyParams = new URLSearchParams({ oauth_verifier: verifier });

  const response = await fetch(HATENA_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      ...authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Hatena OAuth] Access Token Error Response:", errorText);
    throw new Error(
      `Failed to get access token: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const text = await response.text();
  const params = new URLSearchParams(text);

  const accessToken = params.get("oauth_token");
  const accessTokenSecret = params.get("oauth_token_secret");

  if (!accessToken || !accessTokenSecret) {
    throw new Error("Invalid response from Hatena OAuth: missing access token or secret");
  }

  return { accessToken, accessTokenSecret };
}

// Create signed request to Hatena API
export function createSignedRequest(
  url: string,
  method: string,
  accessToken: string,
  accessTokenSecret: string,
  data?: Record<string, string>,
): Record<string, string> {
  const oauth = createOAuthClient();

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
