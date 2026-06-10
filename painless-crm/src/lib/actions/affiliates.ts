'use server';

import { requireRole } from '@/lib/auth/require-role';
import {
  AffiliateCodeSchema,
  AffiliateIdSchema,
  AffiliateSchema,
  AffiliateVersionSchema,
} from '@/lib/schemas/affiliate';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Affiliates are partner records managed by managers and admins.
const AFFILIATE_ROLES = ['manager', 'admin', 'super_admin'] as const;
const ADMIN_ROLES = ['admin', 'super_admin'] as const;

export type AffiliateActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; id?: string };

export const INITIAL_AFFILIATE_STATE: AffiliateActionState = { status: 'idle' };

// commission_value is entered as a percent for percent_revenue, or in £ for
// flat_per_job (converted to pence here). See schemas/affiliate.ts contract.
function normaliseCommissionValue(form: FormData): string {
  const type = form.get('commission_type');
  const raw =
    typeof form.get('commission_value') === 'string'
      ? (form.get('commission_value') as string).trim()
      : '';
  if (raw === '') return '';
  if (type === 'flat_per_job') {
    const pounds = Number(raw);
    return Number.isFinite(pounds) ? String(Math.round(pounds * 100)) : raw;
  }
  return raw;
}

function readPayload(form: FormData) {
  return {
    name: form.get('name'),
    type: form.get('type'),
    contact_name: form.get('contact_name'),
    contact_email: form.get('contact_email'),
    contact_phone: form.get('contact_phone'),
    commission_type: form.get('commission_type') || undefined,
    commission_value: normaliseCommissionValue(form),
    active: form.get('active') === 'on',
  };
}

export async function createAffiliate(
  _prev: AffiliateActionState,
  form: FormData,
): Promise<AffiliateActionState> {
  const me = await requireRole(AFFILIATE_ROLES);

  const parsed = AffiliateSchema.safeParse(readPayload(form));
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('affiliates')
    .insert({
      company_id: me.company_id,
      name: parsed.data.name,
      type: parsed.data.type,
      contact_name: parsed.data.contact_name ?? null,
      contact_email: parsed.data.contact_email ?? null,
      contact_phone: parsed.data.contact_phone ?? null,
      commission_type: parsed.data.commission_type ?? null,
      commission_value: parsed.data.commission_value ?? null,
      active: parsed.data.active,
    })
    .select('id')
    .single();
  if (error || !data) return { status: 'error', message: 'Could not create affiliate' };

  revalidatePath('/dashboard/affiliates');
  redirect(`/dashboard/affiliates/${data.id}`);
}

export async function updateAffiliate(
  _prev: AffiliateActionState,
  form: FormData,
): Promise<AffiliateActionState> {
  await requireRole(AFFILIATE_ROLES);

  const idResult = AffiliateIdSchema.safeParse(form.get('id'));
  const versionResult = AffiliateVersionSchema.safeParse(form.get('version'));
  if (!idResult.success || !versionResult.success) {
    return { status: 'error', message: 'Missing id or version' };
  }

  const parsed = AffiliateSchema.safeParse(readPayload(form));
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('affiliates')
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      contact_name: parsed.data.contact_name ?? null,
      contact_email: parsed.data.contact_email ?? null,
      contact_phone: parsed.data.contact_phone ?? null,
      commission_type: parsed.data.commission_type ?? null,
      commission_value: parsed.data.commission_value ?? null,
      active: parsed.data.active,
      version: versionResult.data + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', idResult.data)
    .eq('version', versionResult.data)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) return { status: 'error', message: 'Could not update affiliate' };
  if (!data) {
    return {
      status: 'error',
      message: 'This affiliate was edited elsewhere. Reload to see the latest.',
    };
  }

  revalidatePath(`/dashboard/affiliates/${idResult.data}`);
  revalidatePath('/dashboard/affiliates');
  redirect(`/dashboard/affiliates/${idResult.data}`);
}

// Approve a self-registered application, or pause/reactivate an affiliate.
export async function setAffiliateActive(
  _prev: AffiliateActionState,
  form: FormData,
): Promise<AffiliateActionState> {
  await requireRole(AFFILIATE_ROLES);

  const idResult = AffiliateIdSchema.safeParse(form.get('id'));
  const versionResult = AffiliateVersionSchema.safeParse(form.get('version'));
  if (!idResult.success || !versionResult.success) {
    return { status: 'error', message: 'Missing id or version' };
  }
  const active = form.get('active') === 'true';

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('affiliates')
    .update({
      active,
      version: versionResult.data + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', idResult.data)
    .eq('version', versionResult.data)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    return { status: 'error', message: 'Could not update. Reload and retry.' };
  }

  revalidatePath(`/dashboard/affiliates/${idResult.data}`);
  revalidatePath('/dashboard/affiliates');
  return { status: 'ok' };
}

export async function addAffiliateCode(
  _prev: AffiliateActionState,
  form: FormData,
): Promise<AffiliateActionState> {
  const me = await requireRole(AFFILIATE_ROLES);

  const parsed = AffiliateCodeSchema.safeParse({
    affiliate_id: form.get('affiliate_id'),
    code: form.get('code'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid code' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('affiliate_codes').insert({
    company_id: me.company_id,
    affiliate_id: parsed.data.affiliate_id,
    code: parsed.data.code,
    active: true,
  });
  if (error) {
    const dup = error.code === '23505';
    return {
      status: 'error',
      message: dup ? 'That code is already taken' : 'Could not add the code',
    };
  }

  revalidatePath(`/dashboard/affiliates/${parsed.data.affiliate_id}`);
  return { status: 'ok' };
}

export async function toggleAffiliateCode(
  _prev: AffiliateActionState,
  form: FormData,
): Promise<AffiliateActionState> {
  await requireRole(AFFILIATE_ROLES);

  const codeId = AffiliateIdSchema.safeParse(form.get('code_id'));
  const affiliateId = AffiliateIdSchema.safeParse(form.get('affiliate_id'));
  if (!codeId.success || !affiliateId.success) {
    return { status: 'error', message: 'Missing code id' };
  }
  const active = form.get('active') === 'true';

  const supabase = await createClient();
  const { error } = await supabase.from('affiliate_codes').update({ active }).eq('id', codeId.data);
  if (error) return { status: 'error', message: 'Could not update the code' };

  revalidatePath(`/dashboard/affiliates/${affiliateId.data}`);
  return { status: 'ok' };
}

export async function softDeleteAffiliate(
  _prev: AffiliateActionState,
  form: FormData,
): Promise<AffiliateActionState> {
  await requireRole(ADMIN_ROLES);

  const idResult = AffiliateIdSchema.safeParse(form.get('id'));
  const versionResult = AffiliateVersionSchema.safeParse(form.get('version'));
  if (!idResult.success || !versionResult.success) {
    return { status: 'error', message: 'Missing id or version' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('affiliates')
    .update({ deleted_at: new Date().toISOString(), version: versionResult.data + 1 })
    .eq('id', idResult.data)
    .eq('version', versionResult.data)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error || !data) return { status: 'error', message: 'Could not delete affiliate' };

  revalidatePath('/dashboard/affiliates');
  redirect('/dashboard/affiliates');
}
