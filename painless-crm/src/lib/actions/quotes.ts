'use server';

import { requireRole } from '@/lib/auth/require-role';
import { serverEnv } from '@/lib/env';
import { sendQuoteEmail } from '@/lib/integrations/resend/quote';
import { createQuoteForJob } from '@/lib/jobs/quote-writer';
import { parseSimulationForm } from '@/lib/pricing/form';
import { supersedePredecessor } from '@/lib/quotes/revisions';
import { signQuoteToken } from '@/lib/quotes/share-tokens';
import { createClient } from '@/lib/supabase/server';
import { customerDisplayName } from '@/lib/utils/format';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const QUOTE_BUILDER_ROLES = ['sales', 'manager', 'admin', 'super_admin'] as const;

export type QuoteBuilderState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; quote_id: string };

export const INITIAL_QUOTE_BUILDER_STATE: QuoteBuilderState = { status: 'idle' };

export type SendQuoteState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; quote_id: string; share_url: string };

export const INITIAL_SEND_QUOTE_STATE: SendQuoteState = { status: 'idle' };

const JobIdSchema = z.string().uuid();
const QuoteIdSchema = z.string().uuid();
const VersionSchema = z.coerce.number().int().min(1);
const OptionalQuoteIdSchema = z
  .string()
  .uuid()
  .or(z.literal(''))
  .optional()
  .transform((v) => (v ? v : null));

export async function buildManualQuote(
  _prev: QuoteBuilderState,
  form: FormData,
): Promise<QuoteBuilderState> {
  const me = await requireRole(QUOTE_BUILDER_ROLES);

  const jobIdParse = JobIdSchema.safeParse(form.get('job_id'));
  if (!jobIdParse.success) {
    return { status: 'error', message: 'Invalid job id' };
  }
  const jobId = jobIdParse.data;

  const revisedFromRaw = form.get('revised_from_id');
  const revisedFromParse = OptionalQuoteIdSchema.safeParse(
    typeof revisedFromRaw === 'string' ? revisedFromRaw : undefined,
  );
  if (!revisedFromParse.success) {
    return { status: 'error', message: 'Invalid source quote id' };
  }
  const revisedFromId = revisedFromParse.data;

  const inputResult = parseSimulationForm(form);
  if (!inputResult.ok) {
    return { status: 'error', message: inputResult.message };
  }

  const supabase = await createClient();
  const [{ data: job }, { data: version }] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, company_id')
      .eq('id', jobId)
      .eq('company_id', me.company_id)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('pricing_versions')
      .select('id')
      .eq('company_id', me.company_id)
      .is('effective_to', null)
      .is('deleted_at', null)
      .maybeSingle(),
  ]);

  if (!job) return { status: 'error', message: 'Job not found' };
  if (!version) {
    return { status: 'error', message: 'No active pricing version. Seed one first.' };
  }

  let quoteId: string;
  try {
    const result = await createQuoteForJob({
      companyId: me.company_id,
      jobId: job.id,
      pricingVersionId: version.id as string,
      input: { ...inputResult.input, source: inputResult.input.source ?? 'manual' },
      revisedFromId,
    });
    quoteId = result.quote_id;
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Could not create quote',
    };
  }
  // redirect() works by THROWING a NEXT_REDIRECT control-flow error, so it must
  // stay OUTSIDE the try above — otherwise the blanket catch swallows a
  // successful create and renders the redirect digest as an error (audit H5).
  revalidatePath(`/dashboard/jobs/${jobId}`);
  redirect(`/dashboard/jobs/${jobId}?quote=${quoteId}`);
}

export async function sendQuote(_prev: SendQuoteState, form: FormData): Promise<SendQuoteState> {
  await requireRole(QUOTE_BUILDER_ROLES);

  const idParse = QuoteIdSchema.safeParse(form.get('quote_id'));
  const versionParse = VersionSchema.safeParse(form.get('version'));
  if (!idParse.success || !versionParse.success) {
    return { status: 'error', message: 'Invalid quote id or version' };
  }
  const env = serverEnv();
  if (!env.QUOTE_LINK_SECRET) {
    return { status: 'error', message: 'Quote link signing is not configured' };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('quotes')
    .select('id, status, version, valid_until')
    .eq('id', idParse.data)
    .is('deleted_at', null)
    .maybeSingle();

  if (!existing) return { status: 'error', message: 'Quote not found' };
  if (existing.status !== 'draft') {
    return { status: 'error', message: 'Only draft quotes can be sent' };
  }
  if (existing.version !== versionParse.data) {
    return { status: 'error', message: 'Quote was edited elsewhere — reload and retry' };
  }

  const { data: updated, error } = await supabase
    .from('quotes')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      version: versionParse.data + 1,
    })
    .eq('id', idParse.data)
    .eq('version', versionParse.data)
    .is('deleted_at', null)
    .select('id, job_id')
    .maybeSingle();
  if (error || !updated) {
    return { status: 'error', message: 'Could not mark quote as sent' };
  }

  await supersedePredecessor(updated.id as string);

  const validUntilMs = new Date(existing.valid_until as string).getTime();
  const ttlSeconds = Math.max(
    60 * 60,
    Math.floor((validUntilMs - Date.now()) / 1000) + 24 * 60 * 60,
  );
  const token = await signQuoteToken(
    { quoteId: updated.id as string, purpose: 'accept', ttlSeconds },
    env.QUOTE_LINK_SECRET,
  );
  const shareUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/quote/${token}`;

  await emailQuoteToCustomer(supabase, updated.job_id as string, shareUrl, existing.valid_until);

  revalidatePath(`/dashboard/jobs/${updated.job_id as string}`);
  return { status: 'ok', quote_id: updated.id as string, share_url: shareUrl };
}

type QuoteEmailCustomer = {
  primary_email: string | null;
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
};

// Best-effort: email the customer their quote link right after sending.
// A send/lookup failure must never fail the action — the rep can re-share.
async function emailQuoteToCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
  shareUrl: string,
  validUntil: string | null,
): Promise<void> {
  try {
    const { data } = await supabase
      .from('jobs')
      .select(
        'quote_total_pence, customer:customers (primary_email, customer_type, first_name, last_name, company_name)',
      )
      .eq('id', jobId)
      .maybeSingle();
    if (!data) return;
    const raw = (data as { customer?: unknown }).customer;
    const customer = (Array.isArray(raw) ? raw[0] : raw) as QuoteEmailCustomer | null | undefined;
    if (!customer?.primary_email) return;
    await sendQuoteEmail({
      to: customer.primary_email,
      customerName: customerDisplayName({ ...customer, primary_email: customer.primary_email }),
      shareUrl,
      totalPence: (data as { quote_total_pence: number | null }).quote_total_pence ?? null,
      validUntil,
    });
  } catch {
    // best-effort: emailing must never fail the send
  }
}
