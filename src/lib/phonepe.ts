import type { ApiLog } from "./types";

const ENV_CONFIG = {
  sandbox: {
    base_url: "https://api-preprod.phonepe.com/apis/pg-sandbox",
    token_url: "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
    sdk_domain: "https://mercury-stg.phonepe.com",
  },
  production: {
    base_url: "https://api.phonepe.com/apis/pg",
    token_url: "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
    sdk_domain: "https://mercury-t2.phonepe.com",
  },
};

const PHONEPE_ENV = (process.env.PHONEPE_ENV || "sandbox") as "sandbox" | "production";
const PHONEPE_CLIENT_ID = process.env.PHONEPE_CLIENT_ID || "";
const PHONEPE_CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET || "";
const PHONEPE_CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || "1";
export const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || "";
export const SDK_DOMAIN = ENV_CONFIG[PHONEPE_ENV].sdk_domain;

// Token cache (in-memory, resets on cold start)
const tokenCache: { access_token: string | null; expires_at: number } = {
  access_token: null,
  expires_at: 0,
};

function makeLog(
  step: string,
  method: string,
  url: string,
  reqHeaders: Record<string, string>,
  reqBody: unknown,
  respStatus: number,
  respHeaders: Record<string, string>,
  respBody: unknown
): ApiLog {
  return {
    step,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
    request: { method, url, headers: reqHeaders, body: reqBody },
    response: { status_code: respStatus, headers: respHeaders, body: respBody },
  };
}

export async function getAccessToken(): Promise<{ token: string | null; log: ApiLog }> {
  const now = Date.now() / 1000;
  if (tokenCache.access_token && now < tokenCache.expires_at - 60) {
    // Return cached token with a minimal log entry
    const log = makeLog(
      "1. OAuth Token (cached)",
      "POST",
      ENV_CONFIG[PHONEPE_ENV].token_url,
      {},
      null,
      200,
      {},
      { note: "Using cached token" }
    );
    return { token: tokenCache.access_token, log };
  }

  const url = ENV_CONFIG[PHONEPE_ENV].token_url;
  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const body = new URLSearchParams({
    client_id: PHONEPE_CLIENT_ID,
    client_version: PHONEPE_CLIENT_VERSION,
    client_secret: PHONEPE_CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  let respBody: unknown;
  let respStatus = 0;
  let respHeaders: Record<string, string> = {};

  try {
    const resp = await fetch(url, { method: "POST", headers: reqHeaders, body });
    respStatus = resp.status;
    resp.headers.forEach((v, k) => { respHeaders[k] = v; });
    try { respBody = await resp.json(); } catch { respBody = await resp.text(); }

    if (resp.ok && respBody && typeof respBody === "object") {
      const data = respBody as { access_token: string; expires_at?: number };
      tokenCache.access_token = data.access_token;
      tokenCache.expires_at = data.expires_at ?? now + 600;
    }
  } catch (err) {
    respBody = { error: String(err) };
  }

  const log = makeLog("1. OAuth Token", "POST", url, reqHeaders, Object.fromEntries(body), respStatus, respHeaders, respBody);
  return { token: tokenCache.access_token, log };
}

export async function initiatePayment(
  amountPaisa: number,
  merchantOrderId: string,
  redirectUrl: string
): Promise<{ data: unknown; logs: ApiLog[] }> {
  const { token, log: tokenLog } = await getAccessToken();
  const logs: ApiLog[] = [tokenLog];

  if (!token) return { data: null, logs };

  const url = `${ENV_CONFIG[PHONEPE_ENV].base_url}/checkout/v2/pay`;
  const reqHeaders: Record<string, string> = {
    Authorization: `O-Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const payload = {
    merchantOrderId,
    amount: amountPaisa,
    paymentFlow: {
      type: "PG_CHECKOUT",
      merchantUrls: { redirectUrl },
    },
  };

  let respBody: unknown;
  let respStatus = 0;
  let respHeaders: Record<string, string> = {};

  try {
    const resp = await fetch(url, { method: "POST", headers: reqHeaders, body: JSON.stringify(payload) });
    respStatus = resp.status;
    resp.headers.forEach((v, k) => { respHeaders[k] = v; });
    try { respBody = await resp.json(); } catch { respBody = await resp.text(); }
  } catch (err) {
    respBody = { error: String(err) };
  }

  logs.push(makeLog("2. Initiate Payment", "POST", url, reqHeaders, payload, respStatus, respHeaders, respBody));
  return { data: respStatus === 200 ? respBody : null, logs };
}

export async function createOrderToken(
  amountPaisa: number,
  merchantOrderId: string
): Promise<{ data: unknown; logs: ApiLog[] }> {
  const { token, log: tokenLog } = await getAccessToken();
  const logs: ApiLog[] = [tokenLog];

  if (!token) return { data: null, logs };

  const url = `${ENV_CONFIG[PHONEPE_ENV].base_url}/payments/v2/sdk/order`;
  const reqHeaders: Record<string, string> = {
    Authorization: `O-Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const payload = {
    merchantOrderId,
    amount: amountPaisa,
    paymentFlow: { type: "PG" },
  };

  let respBody: unknown;
  let respStatus = 0;
  let respHeaders: Record<string, string> = {};

  try {
    const resp = await fetch(url, { method: "POST", headers: reqHeaders, body: JSON.stringify(payload) });
    respStatus = resp.status;
    resp.headers.forEach((v, k) => { respHeaders[k] = v; });
    try { respBody = await resp.json(); } catch { respBody = await resp.text(); }
  } catch (err) {
    respBody = { error: String(err) };
  }

  logs.push(makeLog("2. Create Order Token (Card Checkout)", "POST", url, reqHeaders, payload, respStatus, respHeaders, respBody));
  return { data: respStatus === 200 ? respBody : null, logs };
}

export async function checkPaymentStatus(
  merchantOrderId: string
): Promise<{ data: unknown; logs: ApiLog[] }> {
  const { token, log: tokenLog } = await getAccessToken();
  const logs: ApiLog[] = [tokenLog];

  if (!token) return { data: null, logs };

  const url = `${ENV_CONFIG[PHONEPE_ENV].base_url}/checkout/v2/order/${merchantOrderId}/status?details=true&errorContext=true`;
  const reqHeaders: Record<string, string> = {
    Authorization: `O-Bearer ${token}`,
    "Content-Type": "application/json",
  };

  let respBody: unknown;
  let respStatus = 0;
  let respHeaders: Record<string, string> = {};

  try {
    const resp = await fetch(url, { method: "GET", headers: reqHeaders });
    respStatus = resp.status;
    resp.headers.forEach((v, k) => { respHeaders[k] = v; });
    try { respBody = await resp.json(); } catch { respBody = await resp.text(); }
  } catch (err) {
    respBody = { error: String(err) };
  }

  logs.push(makeLog("3. Check Payment Status", "GET", url, reqHeaders, undefined, respStatus, respHeaders, respBody));
  return { data: respStatus === 200 ? respBody : null, logs };
}
