// Public unsubscribe (ADR-047). The review emails carry List-Unsubscribe
// (+ One-Click), so this answers both a human GET (confirmation page) and the
// mailbox provider's one-click POST (204). The token is the review_request id;
// no auth — the token is the capability. Sets the request to 'unsubscribed' and
// adds a persistent suppression so the address is never emailed again.

import { addSuppression } from '@/lib/reviews/repo/suppression';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ token: string }> };

interface Loaded {
  id: string;
  companyId: string;
  email: string | null;
}

function one<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T) ?? null;
  return (raw as T) ?? null;
}

async function unsubscribe(token: string): Promise<boolean> {
  if (!UUID_RE.test(token)) return false;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('review_requests')
    .select('id, company_id, customer:customers(primary_email)')
    .eq('id', token)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return false;

  const row = data as unknown as Record<string, unknown>;
  const customer = one<{ primary_email: string | null }>(row.customer);
  const loaded: Loaded = {
    id: row.id as string,
    companyId: row.company_id as string,
    email: customer?.primary_email ?? null,
  };

  const now = new Date().toISOString();
  await supabase
    .from('review_requests')
    .update({ status: 'unsubscribed', responded_at: now, updated_at: now })
    .eq('id', loaded.id);
  if (loaded.email) {
    await addSuppression(supabase, loaded.companyId, loaded.email, 'unsubscribe');
  }
  return true;
}

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;text-align:center;color:#1a1a1a">
<h1 style="font-size:24px">${title}</h1><p style="color:#555;font-size:16px">${body}</p></body></html>`;
}

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { token } = await params;
  await unsubscribe(token);
  // Always confirm success (even on an unknown token) so we never reveal whether
  // an address is on the list.
  return new NextResponse(
    page('Unsubscribed', "You won't receive any more review emails from us. Thank you!"),
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

export async function POST(_req: Request, { params }: Params): Promise<Response> {
  const { token } = await params;
  await unsubscribe(token);
  return new NextResponse(null, { status: 204 });
}

export const runtime = 'nodejs';
