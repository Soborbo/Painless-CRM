import { createVerify, generateKeyPairSync } from 'node:crypto';
import {
  __clearTokenCache,
  base64UrlEncode,
  buildSignedJwt,
  getAccessToken,
  pemToArrayBuffer,
} from '@/lib/integrations/gmail/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A throwaway RSA keypair so the test exercises the real Web Crypto signing path
// (RS256) and verifies the output against the public key with node:crypto.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PKCS8_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const SPKI_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const CREDS = {
  clientEmail: 'sa@project.iam.gserviceaccount.com',
  privateKeyPem: PKCS8_PEM,
  subject: 'info@painlessremovals.com',
};

function decodeJwtPart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf-8'));
}

describe('base64UrlEncode', () => {
  it('matches the url-safe, unpadded base64 alphabet', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255]);
    expect(base64UrlEncode(bytes)).toBe(Buffer.from(bytes).toString('base64url'));
  });
});

describe('pemToArrayBuffer', () => {
  it('decodes a PKCS#8 PEM and tolerates literal \\n escapes', () => {
    const escaped = PKCS8_PEM.replace(/\n/g, '\\n');
    expect(new Uint8Array(pemToArrayBuffer(escaped))).toEqual(
      new Uint8Array(pemToArrayBuffer(PKCS8_PEM)),
    );
  });
});

describe('buildSignedJwt', () => {
  it('emits an RS256 JWT with the SA/DWD claim set, verifiable by the public key', async () => {
    const now = 1_700_000_000_000;
    const jwt = await buildSignedJwt(CREDS, now);
    const [h = '', p = '', sig = ''] = jwt.split('.');

    expect(decodeJwtPart(h)).toEqual({ alg: 'RS256', typ: 'JWT' });
    const claim = decodeJwtPart(p);
    expect(claim).toMatchObject({
      iss: CREDS.clientEmail,
      sub: CREDS.subject,
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 3600,
    });

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${h}.${p}`);
    verifier.end();
    expect(verifier.verify(SPKI_PEM, Buffer.from(sig, 'base64url'))).toBe(true);
  });
});

describe('getAccessToken', () => {
  beforeEach(() => __clearTokenCache());
  afterEach(() => vi.unstubAllGlobals());

  it('exchanges the JWT and caches the token (one network call for two reads)', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ access_token: 'ya29.test', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const now = 1_700_000_000_000;
    const a = await getAccessToken(CREDS, now);
    const b = await getAccessToken(CREDS, now + 1000);
    expect(a).toEqual({ ok: true, token: 'ya29.test', expiresAt: now + 3600_000 });
    expect(b.ok && b.token).toBe('ya29.test');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a typed sign_failed (never throws) on a bad private key', async () => {
    const res = await getAccessToken({ ...CREDS, privateKeyPem: 'not-a-pem' }, Date.now());
    expect(res).toMatchObject({ ok: false, reason: 'sign_failed' });
  });

  it('returns token_request_failed on a non-200 from Google', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 401 })),
    );
    const res = await getAccessToken(CREDS, Date.now());
    expect(res).toMatchObject({ ok: false, reason: 'token_request_failed', error: 'http_401' });
  });
});
