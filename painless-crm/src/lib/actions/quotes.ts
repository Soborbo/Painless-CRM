'use server';

import { requireRole } from '@/lib/auth/require-role';
import { createQuoteForJob } from '@/lib/jobs/quote-writer';
import { parseSimulationForm } from '@/lib/pricing/form';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const QUOTE_BUILDER_ROLES = ['sales', 'manager', 'admin', 'super_admin'] as const;

export type QuoteBuilderState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; quote_id: string };

export const INITIAL_QUOTE_BUILDER_STATE: QuoteBuilderState = { status: 'idle' };

const JobIdSchema = z.string().uuid();

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

  try {
    const result = await createQuoteForJob({
      companyId: me.company_id,
      jobId: job.id,
      pricingVersionId: version.id as string,
      input: { ...inputResult.input, source: inputResult.input.source ?? 'manual' },
    });
    revalidatePath(`/dashboard/jobs/${jobId}`);
    redirect(`/dashboard/jobs/${jobId}?quote=${result.quote_id}`);
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Could not create quote',
    };
  }
}
