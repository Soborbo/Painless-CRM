'use server';

import { requireRole } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Sales-side withdrawal of a sent or draft quote. The customer's share token
// stops accepting because the quote ends up `expired`; the auxiliary columns
// (withdrawn_at + reason + actor) keep the cause traceable so the dashboard
// can distinguish "rep retracted this" from "validity ran out".

const WITHDRAW_ROLES = ['sales', 'manager', 'admin', 'super_admin'] as const;

const FormSchema = z.object({
  quote_id: z.string().uuid(),
  reason: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)),
});

export type WithdrawQuoteState =
  | { status: 'idle' }
  | {
      status: 'error';
      reason: 'invalid_input' | 'not_found' | 'wrong_status' | 'unknown';
    }
  | { status: 'ok'; quote_id: string };

export const INITIAL_WITHDRAW_QUOTE_STATE: WithdrawQuoteState = { status: 'idle' };

export async function withdrawQuote(
  _prev: WithdrawQuoteState,
  form: FormData,
): Promise<WithdrawQuoteState> {
  const me = await requireRole(WITHDRAW_ROLES);

  const parsed = FormSchema.safeParse({
    quote_id: form.get('quote_id'),
    reason: form.get('reason') ?? undefined,
  });
  if (!parsed.success) return { status: 'error', reason: 'invalid_input' };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('quotes')
    .select('id, status, job_id')
    .eq('id', parsed.data.quote_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!existing) return { status: 'error', reason: 'not_found' };
  if (existing.status !== 'draft' && existing.status !== 'sent') {
    return { status: 'error', reason: 'wrong_status' };
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('quotes')
    .update({
      status: 'expired',
      withdrawn_at: nowIso,
      withdrawn_by_user_id: me.id,
      withdrawal_reason: parsed.data.reason,
    })
    .eq('id', parsed.data.quote_id)
    .in('status', ['draft', 'sent']);
  if (error) return { status: 'error', reason: 'unknown' };

  revalidatePath(`/dashboard/jobs/${existing.job_id as string}`);
  return { status: 'ok', quote_id: parsed.data.quote_id };
}
