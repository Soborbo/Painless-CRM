import { createClient } from '@/lib/supabase/server';

// Phase 13 §4 — template reads. RLS scopes to the company.

export interface EmailTemplateRow {
  id: string;
  name: string;
  category: string | null;
  subject_template: string;
  body_template: string;
  active: boolean;
}

export interface SmsTemplateRow {
  id: string;
  name: string;
  body_template: string;
  active: boolean;
}

export async function listEmailTemplates(): Promise<EmailTemplateRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('email_templates')
    .select('id, name, category, subject_template, body_template, active')
    .order('name', { ascending: true });
  return (data ?? []) as EmailTemplateRow[];
}

export async function getEmailTemplate(id: string): Promise<EmailTemplateRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('email_templates')
    .select('id, name, category, subject_template, body_template, active')
    .eq('id', id)
    .maybeSingle();
  return (data as EmailTemplateRow | null) ?? null;
}

export async function listSmsTemplates(): Promise<SmsTemplateRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('sms_templates')
    .select('id, name, body_template, active')
    .order('name', { ascending: true });
  return (data ?? []) as SmsTemplateRow[];
}

export async function getSmsTemplate(id: string): Promise<SmsTemplateRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('sms_templates')
    .select('id, name, body_template, active')
    .eq('id', id)
    .maybeSingle();
  return (data as SmsTemplateRow | null) ?? null;
}
