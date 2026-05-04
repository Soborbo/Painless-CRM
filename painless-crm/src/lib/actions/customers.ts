'use server';

import { requireRole } from '@/lib/auth/require-role';
import { findDuplicateCandidates } from '@/lib/queries/customers';
import { CustomerIdSchema, CustomerSchema, CustomerVersionSchema } from '@/lib/schemas/customer';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const SALES_ROLES = ['sales', 'manager', 'admin', 'super_admin'] as const;
const ADMIN_ROLES = ['admin', 'super_admin', 'manager'] as const;

export type CustomerActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'duplicate'; candidates: { id: string; label: string }[] }
  | { status: 'ok'; id: string };

const IDLE: CustomerActionState = { status: 'idle' };

function readPayload(form: FormData) {
  return {
    customer_type: form.get('customer_type'),
    first_name: form.get('first_name'),
    last_name: form.get('last_name'),
    company_name: form.get('company_name'),
    vat_number: form.get('vat_number'),
    payment_terms_days: form.get('payment_terms_days'),
    primary_email: form.get('primary_email'),
    primary_phone: form.get('primary_phone'),
    acquisition_source: form.get('acquisition_source') || undefined,
    acquisition_campaign: form.get('acquisition_campaign'),
    marketing_consent: form.get('marketing_consent') === 'on',
    notes: form.get('notes'),
  };
}

function candidateLabel(c: {
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_email: string | null;
}) {
  if (c.customer_type === 'business' && c.company_name) return c.company_name;
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ');
  return name || c.primary_email || 'Unnamed customer';
}

export async function createCustomer(
  _prev: CustomerActionState,
  form: FormData,
): Promise<CustomerActionState> {
  const me = await requireRole(SALES_ROLES);

  const parsed = CustomerSchema.safeParse(readPayload(form));
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  if (form.get('force') !== 'true') {
    const dupes = await findDuplicateCandidates({
      email: parsed.data.primary_email,
      phone: parsed.data.primary_phone,
    });
    if (dupes.length > 0) {
      return {
        status: 'duplicate',
        candidates: dupes.map((c) => ({ id: c.id, label: candidateLabel(c) })),
      };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .insert({
      ...parsed.data,
      company_id: me.company_id,
      created_by_id: me.id,
      updated_by_id: me.id,
      marketing_consent_at: parsed.data.marketing_consent ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error || !data) return { status: 'error', message: 'Could not create customer' };

  revalidatePath('/dashboard/customers');
  redirect(`/dashboard/customers/${data.id}`);
}

export async function updateCustomer(
  _prev: CustomerActionState,
  form: FormData,
): Promise<CustomerActionState> {
  const me = await requireRole(SALES_ROLES);

  const idResult = CustomerIdSchema.safeParse(form.get('id'));
  const versionResult = CustomerVersionSchema.safeParse(form.get('version'));
  if (!idResult.success || !versionResult.success) {
    return { status: 'error', message: 'Missing id or version' };
  }

  const parsed = CustomerSchema.safeParse(readPayload(form));
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .update({
      ...parsed.data,
      updated_by_id: me.id,
      version: versionResult.data + 1,
      marketing_consent_at: parsed.data.marketing_consent ? new Date().toISOString() : null,
    })
    .eq('id', idResult.data)
    .eq('version', versionResult.data)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) return { status: 'error', message: 'Could not update customer' };
  if (!data) {
    return {
      status: 'error',
      message: 'This customer was edited elsewhere. Reload to see the latest.',
    };
  }

  revalidatePath(`/dashboard/customers/${idResult.data}`);
  revalidatePath('/dashboard/customers');
  redirect(`/dashboard/customers/${idResult.data}`);
}

export async function softDeleteCustomer(
  _prev: CustomerActionState,
  form: FormData,
): Promise<CustomerActionState> {
  await requireRole(ADMIN_ROLES);

  const idResult = CustomerIdSchema.safeParse(form.get('id'));
  const versionResult = CustomerVersionSchema.safeParse(form.get('version'));
  if (!idResult.success || !versionResult.success) {
    return { status: 'error', message: 'Missing id or version' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .update({
      deleted_at: new Date().toISOString(),
      version: versionResult.data + 1,
    })
    .eq('id', idResult.data)
    .eq('version', versionResult.data)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    return { status: 'error', message: 'Could not delete customer' };
  }

  revalidatePath('/dashboard/customers');
  redirect('/dashboard/customers');
}

export { IDLE as INITIAL_CUSTOMER_STATE };
