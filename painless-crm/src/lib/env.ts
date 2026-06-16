import { z } from 'zod';

const ServerEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  CRM_WEBHOOK_SECRET: z.string().min(32).optional(),
  // The tenant that inbound webhooks belong to. When set, the webhook handler
  // uses THIS company_id instead of the attacker-controllable body value,
  // closing the cross-tenant injection in audit H2. Single-tenant today; a
  // (source -> company) mapping table is the multi-tenant evolution (ADR-038).
  WEBHOOK_COMPANY_ID: z.string().uuid().optional(),
  QUOTE_LINK_SECRET: z.string().min(32).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // Tamar Call Stats (CDR) API — ADR-041. The cron polls Tamar for call records
  // on our hosted number(s) and ingests them as inbound calls. Tamar uses HTTP
  // Basic auth: base64(login:token), so it needs BOTH the account code and the
  // API token. All optional: missing creds => the poll degrades to a no-op (like
  // RESEND_API_KEY). Non-OAuth API creds live in env per ADR-009 rule 16.
  TAMAR_API_LOGIN: z.string().min(1).optional(),
  TAMAR_API_TOKEN: z.string().min(1).optional(),
  TAMAR_API_BASE: z.string().url().optional(),
  // Our Tamar-hosted number(s), comma-separated, any format — normalised to
  // E.164 at read time. Used both to poll (?number=) and to classify a CDR's
  // direction (a call *to* one of these is inbound).
  TAMAR_NUMBERS: z.string().min(1).optional(),
  // Compare My Move lead webhook (ADR-043). CMM signs each lead with
  // HMAC-SHA256(timestamp + token) under a shared secret we agree with them and
  // puts the digest in the body's `signature` field (NOT our first-party header
  // scheme — hence the v3 body-signed handler). In CMM V3 the "unique token"
  // shown in their Lead Manager IS this shared secret (one value), so verifying
  // the HMAC with it is the complete auth — no separate token check is needed.
  // Optional: absent => the route returns 503, like CRM_WEBHOOK_SECRET.
  CMM_WEBHOOK_SECRET: z.string().min(16).optional(),
});

const ClientEnv = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type ServerEnvShape = z.infer<typeof ServerEnv>;
export type ClientEnvShape = z.infer<typeof ClientEnv>;

let cachedServer: ServerEnvShape | undefined;
let cachedClient: ClientEnvShape | undefined;

export function serverEnv(): ServerEnvShape {
  if (cachedServer) return cachedServer;
  const parsed = ServerEnv.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server env: ${parsed.error.message}`);
  }
  cachedServer = parsed.data;
  return cachedServer;
}

export function clientEnv(): ClientEnvShape {
  if (cachedClient) return cachedClient;
  const parsed = ClientEnv.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(`Invalid client env: ${parsed.error.message}`);
  }
  cachedClient = parsed.data;
  return cachedClient;
}
