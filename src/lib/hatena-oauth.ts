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

  const authorized = oauth.authorize(requestData);
  const authHeader = oauth.toHeader(authorized);

  console.log("[Hatena OAuth] Request Token - URL:", HATENA_REQUEST_TOKEN_URL);
  console.log("[Hatena OAuth] Request Token - Callback:", callbackUrl);
  console.log("[Hatena OAuth] Request Token - Authorized data:", authorized);
  console.log("[Hatena OAuth] Request Token - Auth Header:", authHeader);

  // The oauth_callback is included in the Authorization header by oauth-1.0a
  // We need to also send it as a query parameter or form body
  const response = await fetch(HATENA_REQUEST_TOKEN_URL, {
    method: "POST",
    headers: {
      ...authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ oauth_callback: callbackUrl }).toString(),
  });

  console.log("[Hatena OAuth] Response Status:", response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Hatena OAuth] Error Response:", errorText);
    throw new Error(`Failed to get request token: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const text = await response.text();
  console.log("[Hatena OAuth] Response Body:", text);

  const params = new URLSearchParams(text);

  const token = params.get("oauth_token");
  const tokenSecret = params.get("oauth_token_secret");

  if (!token || !tokenSecret) {
    throw new Error("Invalid response from Hatena OAuth: missing token or secret");
  }

  console.log("[Hatena OAuth] Got tokens - token:", token.substring(0, 10) + "...");
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
      oauth_verifier: verifier,
      // Do NOT include oauth_callback here - it will cause parameter_rejected error
    },
  };

  const authorized = oauth.authorize(requestData, { key: token, secret: tokenSecret });
  const authHeader = oauth.toHeader(authorized);

  console.log("[Hatena OAuth] Access Token - URL:", HATENA_ACCESS_TOKEN_URL);
  console.log("[Hatena OAuth] Access Token - Verifier:", verifier);
  console.log("[Hatena OAuth] Access Token - Authorized data:", authorized);
  console.log("[Hatena OAuth] Access Token - Auth Header:", authHeader);

  // Send oauth_verifier in the request body
  const response = await fetch(HATENA_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      ...authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ oauth_verifier: verifier }).toString(),
  });

  console.log("[Hatena OAuth] Access Token Response Status:", response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Hatena OAuth] Access Token Error Response:", errorText);
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const text = await response.text();
  console.log("[Hatena OAuth] Access Token Response Body:", text);

  const params = new URLSearchParams(text);

  const accessToken = params.get("oauth_token");
  const accessTokenSecret = params.get("oauth_token_secret");

  if (!accessToken || !accessTokenSecret) {
    throw new Error("Invalid response from Hatena OAuth: missing access token or secret");
  }

  console.log("[Hatena OAuth] Got access tokens - token:", accessToken.substring(0, 10) + "...");
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
