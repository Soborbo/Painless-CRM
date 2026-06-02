'use server';

import { requireRole } from '@/lib/auth/require-role';
import {
  COMMISSION_TRANSITIONS,
  CommissionActionSchema,
  type CommissionStatus,
} from '@/lib/schemas/commission';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const BILLING_ROLES = ['accounts', 'manager', 'admin', 'super_admin'] as const;

export type CommissionActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_COMMISSION_STATE: CommissionActionState = { status: 'idle' };

export async function updateCommissionStatus(
  _prev: CommissionActionState,
  form: FormData,
): Promise<CommissionActionState> {
  await requireRole(BILLING_ROLES);

  const parsed = CommissionActionSchema.safeParse({
    id: form.get('id'),
    action: form.get('action'),
  });
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid request' };
  }

  const { from, to } = COMMISSION_TRANSITIONS[parsed.data.action];

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('commission_records')
    .select('status')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (!existing) return { status: 'error', message: 'Commission not found' };

  const current = (existing as { status: CommissionStatus }).status;
  if (!from.includes(current)) {
    return { status: 'error', message: `Cannot ${parsed.data.action} a ${current} commission` };
  }

  const patch: Record<string, unknown> = { status: to };
  if (to === 'approved') patch.approved_at = new Date().toISOString();
  if (to === 'paid') patch.paid_at = new Date().toISOString();

  const { error } = await supabase
    .from('commission_records')
    .update(patch)
    .eq('id', parsed.data.id)
    .eq('status', current);
  if (error) return { status: 'error', message: 'Could not update. Reload and retry.' };

  revalidatePath('/dashboard/affiliates/payouts');
  return { status: 'ok' };
}
