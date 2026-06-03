import { requireUser } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';

// Phase 26 — integrations hub (read-only). Reports which providers have stored
// credentials for the tenant. Never returns secret values — only a connected
// flag — per the PII/secret rules. Built-ins that run from env (Resend email,
// server-side tracking) are listed as always-on.

export interface IntegrationStatus {
  provider: string;
  connected: boolean;
  builtIn: boolean;
  category: string;
}

// The catalogue we surface, with the category shown in the UI. Connection state
// for credential-based providers comes from integration_credentials.
const CREDENTIAL_PROVIDERS: { provider: string; category: string }[] = [
  { provider: 'xero', category: 'accounting' },
  { provider: 'gocardless', category: 'payments' },
  { provider: 'google_ads', category: 'advertising' },
  { provider: 'meta_ads', category: 'advertising' },
  { provider: 'meta_whatsapp', category: 'messaging' },
  { provider: 'tamar_telecom', category: 'telephony' },
  { provider: 'liveswitch', category: 'video' },
];

const BUILT_INS: { provider: string; category: string }[] = [
  { provider: 'resend', category: 'email' },
];

export async function getIntegrationStatuses(): Promise<IntegrationStatus[]> {
  const me = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from('integration_credentials')
    .select('provider')
    .eq('company_id', me.company_id);

  const connected = new Set(
    ((data ?? []) as Array<{ provider: string }>).map((r) => r.provider),
  );

  const credentialRows: IntegrationStatus[] = CREDENTIAL_PROVIDERS.map((p) => ({
    provider: p.provider,
    category: p.category,
    builtIn: false,
    connected: connected.has(p.provider),
  }));
  const builtInRows: IntegrationStatus[] = BUILT_INS.map((p) => ({
    provider: p.provider,
    category: p.category,
    builtIn: true,
    connected: true,
  }));

  return [...builtInRows, ...credentialRows];
}
