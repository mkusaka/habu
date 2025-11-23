import OAuth from "oauth-1.0a";
import CryptoJS from "crypto-js";

const HATENA_REQUEST_TOKEN_URL = "https://www.hatena.com/oauth/initiate";
const HATENA_AUTHORIZE_URL = "https://www.hatena.ne.jp/oauth/authorize";
const HATENA_ACCESS_TOKEN_URL = "https://www.hatena.com/oauth/token";

// OAuth 1.0a client setup
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
  callbackUrl: string
): Promise<{ token: string; tokenSecret: string }> {
  const oauth = createOAuthClient();

  const requestData = {
    url: HATENA_REQUEST_TOKEN_URL,
    method: "POST",
    data: { oauth_callback: callbackUrl },
  };

  const headers = oauth.toHeader(oauth.authorize(requestData));

  const response = await fetch(HATENA_REQUEST_TOKEN_URL, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ oauth_callback: callbackUrl }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get request token: ${response.statusText}`);
  }

  const text = await response.text();
  const params = new URLSearchParams(text);

  const token = params.get("oauth_token");
  const tokenSecret = params.get("oauth_token_secret");

  if (!token || !tokenSecret) {
    throw new Error("Invalid response from Hatena OAuth");
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
  verifier: string
): Promise<{ accessToken: string; accessTokenSecret: string }> {
  const oauth = createOAuthClient();

  const requestData = {
    url: HATENA_ACCESS_TOKEN_URL,
    method: "POST",
    data: {
      oauth_token: token,
      oauth_verifier: verifier,
    },
  };

  const headers = oauth.toHeader(
    oauth.authorize(requestData, { key: token, secret: tokenSecret })
  );

  const response = await fetch(HATENA_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      oauth_token: token,
      oauth_verifier: verifier,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`);
  }

  const text = await response.text();
  const params = new URLSearchParams(text);

  const accessToken = params.get("oauth_token");
  const accessTokenSecret = params.get("oauth_token_secret");

  if (!accessToken || !accessTokenSecret) {
    throw new Error("Invalid response from Hatena OAuth");
  }

  return { accessToken, accessTokenSecret };
}

// Create signed request to Hatena API
export function createSignedRequest(
  url: string,
  method: string,
  accessToken: string,
  accessTokenSecret: string,
  data?: Record<string, string>
) {
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
    })
  );

  return headers;
}
