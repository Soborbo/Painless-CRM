// Service-account OAuth2 (JWT-bearer / domain-wide delegation) for the Gmail
// API. SECURITY-CRITICAL: this module mints bearer credentials (CLAUDE.md
// "*/auth.ts" rule). It is deliberately PURE + portable — no Supabase, no Next,
// no env import — so the Gmail core (auth/client/parse) can later be lifted into
// the sister D1 app unchanged. It uses only Web Crypto (crypto.subtle) + fetch +
// btoa/atob, all available on Cloudflare Workers and Node 20.
//
// Flow: build an RS256 JWT asserting `iss=service account`, `sub=impersonated
// mailbox`, `scope=gmail.readonly`, sign it with the SA's PKCS#8 private key,
// and exchange it at Google's token endpoint for a short-lived access token.
// No OAuth consent, no refresh-token storage: the SA key is a static service
// credential (env secret, like RESEND_API_KEY), not a per-user OAuth grant — so
// rule 16 / ADR-009 (integration_credentials) does not apply (see ADR-044).

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWT_BEARER_GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export interface ServiceAccountCreds {
  /** Service-account email (the JWT `iss`). */
  clientEmail: string;
  /** PKCS#8 PEM private key. Literal "\n" escapes are tolerated. */
  privateKeyPem: string;
  /** Impersonated mailbox — the JWT `sub` (domain-wide delegation target). */
  subject: string;
  /** OAuth scope; defaults to gmail.readonly. */
  scope?: string;
}

export type AccessTokenResult =
  | { ok: true; token: string; expiresAt: number }
  | {
      ok: false;
      reason: 'sign_failed' | 'token_request_failed' | 'bad_response';
      error?: string;
    };

/** URL-safe base64 of raw bytes, no padding (JWS/JWT alphabet). */
export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeString(s: string): string {
  return base64UrlEncode(new TextEncoder().encode(s));
}

/** PKCS#8 PEM -> ArrayBuffer. Normalises literal "\n" escapes (common when a
 *  key is pasted into an env var) before stripping the armor + whitespace. */
export function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/** Mint the signed JWT assertion. Pure (given creds + clock); exported for
 *  unit tests that verify the signature against the public key. */
export async function buildSignedJwt(creds: ServiceAccountCreds, nowMs: number): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  const claim = {
    iss: creds.clientEmail,
    sub: creds.subject,
    scope: creds.scope ?? GMAIL_READONLY_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat,
    exp: iat + 3600,
  };
  const unsigned = `${base64UrlEncodeString(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
  )}.${base64UrlEncodeString(JSON.stringify(claim))}`;
  const key = await importPrivateKey(creds.privateKeyPem);
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64UrlEncode(new Uint8Array(sig))}`;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

// In-memory access-token cache keyed by (account|mailbox|scope). Survives within
// an isolate; a cold start just re-mints. Refreshed 60s before real expiry.
const tokenCache = new Map<string, CachedToken>();
const REFRESH_SKEW_MS = 60_000;

function cacheKey(creds: ServiceAccountCreds): string {
  return `${creds.clientEmail}|${creds.subject}|${creds.scope ?? GMAIL_READONLY_SCOPE}`;
}

/** Returns a valid access token, minting + caching one when needed. Degrades to
 *  a typed failure (never throws) so callers can no-op like the Tamar client. */
export async function getAccessToken(
  creds: ServiceAccountCreds,
  nowMs: number = Date.now(),
): Promise<AccessTokenResult> {
  const key = cacheKey(creds);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt - REFRESH_SKEW_MS > nowMs) {
    return { ok: true, token: cached.token, expiresAt: cached.expiresAt };
  }

  let assertion: string;
  try {
    assertion = await buildSignedJwt(creds, nowMs);
  } catch (err) {
    return { ok: false, reason: 'sign_failed', error: errMessage(err) };
  }

  let res: Response;
  try {
    res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: JWT_BEARER_GRANT, assertion }),
    });
  } catch (err) {
    return { ok: false, reason: 'token_request_failed', error: errMessage(err) };
  }
  if (!res.ok) {
    return { ok: false, reason: 'token_request_failed', error: `http_${res.status}` };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: 'bad_response', error: 'invalid_json' };
  }
  const obj = body as { access_token?: unknown; expires_in?: unknown };
  if (typeof obj.access_token !== 'string') {
    return { ok: false, reason: 'bad_response', error: 'no_access_token' };
  }
  const expiresInSec = typeof obj.expires_in === 'number' ? obj.expires_in : 3600;
  const expiresAt = nowMs + expiresInSec * 1000;
  tokenCache.set(key, { token: obj.access_token, expiresAt });
  return { ok: true, token: obj.access_token, expiresAt };
}

/** Test seam: drop the cached tokens. */
export function __clearTokenCache(): void {
  tokenCache.clear();
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 200) : 'error';
}
