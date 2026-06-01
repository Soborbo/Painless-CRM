'use server';

import { requireRole } from '@/lib/auth/require-role';
import { EmailTemplateSchema, SmsTemplateSchema } from '@/lib/schemas/template';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const TEMPLATE_ROLES = ['manager', 'admin', 'super_admin'] as const;

export type TemplateActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok' };

export const INITIAL_TEMPLATE_STATE: TemplateActionState = { status: 'idle' };

const LIST = '/dashboard/settings/templates';

export async function saveEmailTemplate(
  _prev: TemplateActionState,
  form: FormData,
): Promise<TemplateActionState> {
  const me = await requireRole(TEMPLATE_ROLES);

  const parsed = EmailTemplateSchema.safeParse({
    id: form.get('id') || undefined,
    name: form.get('name'),
    category: form.get('category') || undefined,
    subject_template: form.get('subject_template'),
    body_template: form.get('body_template'),
    active: Boolean(form.get('active')),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const fields = {
    name: parsed.data.name,
    category: parsed.data.category ?? null,
    subject_template: parsed.data.subject_template,
    body_template: parsed.data.body_template,
    active: parsed.data.active,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from('email_templates')
      .update(fields)
      .eq('id', parsed.data.id);
    if (error) return { status: 'error', message: 'Could not save the template' };
  } else {
    const { error } = await supabase
      .from('email_templates')
      .insert({ ...fields, company_id: me.company_id, created_by_id: me.id });
    if (error) return { status: 'error', message: 'Could not create the template' };
  }

  revalidatePath(LIST);
  redirect(LIST);
}

export async function saveSmsTemplate(
  _prev: TemplateActionState,
  form: FormData,
): Promise<TemplateActionState> {
  const me = await requireRole(TEMPLATE_ROLES);

  const parsed = SmsTemplateSchema.safeParse({
    id: form.get('id') || undefined,
    name: form.get('name'),
    body_template: form.get('body_template'),
    active: Boolean(form.get('active')),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const fields = {
    name: parsed.data.name,
    body_template: parsed.data.body_template,
    active: parsed.data.active,
  };

  if (parsed.data.id) {
    const { error } = await supabase.from('sms_templates').update(fields).eq('id', parsed.data.id);
    if (error) return { status: 'error', message: 'Could not save the template' };
  } else {
    const { error } = await supabase
      .from('sms_templates')
      .insert({ ...fields, company_id: me.company_id });
    if (error) return { status: 'error', message: 'Could not create the template' };
  }

  revalidatePath(LIST);
  redirect(LIST);
}
