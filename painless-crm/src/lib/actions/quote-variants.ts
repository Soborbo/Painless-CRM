'use server';

import { requireRole } from '@/lib/auth/require-role';
import { AddVariantSchema, RemoveVariantSchema } from '@/lib/schemas/quote-variant';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const VARIANT_ROLES = ['sales', 'manager', 'admin', 'super_admin'] as const;

export type VariantActionState =
  | { status: 'idle' }
  | {
      status: 'error';
      reason: 'invalid_input' | 'parent_not_found' | 'wrong_status' | 'unknown';
    }
  | { status: 'ok'; quote_id: string };

export const INITIAL_VARIANT_STATE: VariantActionState = { status: 'idle' };

export async function addVariant(
  _prev: VariantActionState,
  form: FormData,
): Promise<VariantActionState> {
  const me = await requireRole(VARIANT_ROLES);

  const parsed = AddVariantSchema.safeParse({
    quote_id: form.get('quote_id'),
    variant_label: form.get('variant_label'),
    total_pence: form.get('total_pence'),
    description: form.get('description') ?? undefined,
    display_order: form.get('display_order') ?? undefined,
  });
  if (!parsed.success) return { status: 'error', reason: 'invalid_input' };

  const supabase = await createClient();
  const { data: parent } = await supabase
    .from('quotes')
    .select('id, status, job_id, company_id')
    .eq('id', parsed.data.quote_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!parent) return { status: 'error', reason: 'parent_not_found' };
  if (parent.status !== 'draft' && parent.status !== 'sent') {
    return { status: 'error', reason: 'wrong_status' };
  }

  const { error } = await supabase.from('quote_variants').insert({
    company_id: me.company_id,
    quote_id: parent.id,
    variant_label: parsed.data.variant_label,
    total_pence: parsed.data.total_pence,
    description: parsed.data.description ?? null,
    display_order: parsed.data.display_order,
  });
  if (error) return { status: 'error', reason: 'unknown' };

  revalidatePath(`/dashboard/jobs/${parent.job_id as string}/quote/${parent.id as string}`);
  return { status: 'ok', quote_id: parent.id as string };
}

export async function removeVariant(
  _prev: VariantActionState,
  form: FormData,
): Promise<VariantActionState> {
  await requireRole(VARIANT_ROLES);

  const parsed = RemoveVariantSchema.safeParse({
    variant_id: form.get('variant_id'),
    quote_id: form.get('quote_id'),
  });
  if (!parsed.success) return { status: 'error', reason: 'invalid_input' };

  const supabase = await createClient();
  const { data: parent } = await supabase
    .from('quotes')
    .select('id, status, job_id')
    .eq('id', parsed.data.quote_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!parent) return { status: 'error', reason: 'parent_not_found' };
  if (parent.status !== 'draft' && parent.status !== 'sent') {
    return { status: 'error', reason: 'wrong_status' };
  }

  const { error } = await supabase
    .from('quote_variants')
    .delete()
    .eq('id', parsed.data.variant_id)
    .eq('quote_id', parsed.data.quote_id);
  if (error) return { status: 'error', reason: 'unknown' };

  revalidatePath(`/dashboard/jobs/${parent.job_id as string}/quote/${parent.id as string}`);
  return { status: 'ok', quote_id: parent.id as string };
}
