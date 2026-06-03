import { sendAutomationEmail } from '@/lib/integrations/resend/automation';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderTemplate } from './render';
import { type AddressParts, buildTemplateVars } from './template-vars';

// Phase 13 §5 — automation queue processor. Runs without a user (service-role).
// Pulls due rows, runs the action, logs to messages, and marks each row
// processed at-most-once. Only send_email is wired (Resend, degrades to a log);
// send_sms/whatsapp/etc. are recorded as skipped until those channels land.

const MAX = 200;
type AnyClient = ReturnType<typeof createAdminClient>;

export interface AutomationResult {
  due: number;
  sent: number;
  skipped: number;
  failed: number;
}

interface JobVarContext {
  vars: Record<string, string>;
  email: string | null;
  customerId: string | null;
  /** The job's CURRENT stage — used by the dwell-guard (ADR-024). */
  currentStage: string | null;
}

type CustomerRow = {
  id: string;
  customer_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_email: string | null;
};

function pickAddress(
  rows: Array<{ role: string | null; address: AddressParts | AddressParts[] | null }>,
  role: 'from' | 'to',
): AddressParts | null {
  const match = rows.find((r) => r.role === role);
  if (!match) return null;
  return Array.isArray(match.address) ? (match.address[0] ?? null) : match.address;
}

async function buildVars(
  supabase: AnyClient,
  payload: { job_id?: string; from?: string; to?: string },
): Promise<JobVarContext> {
  const empty: JobVarContext = { vars: {}, email: null, customerId: null, currentStage: null };
  if (!payload.job_id) return empty;
  const { data } = await supabase
    .from('jobs')
    .select(
      'job_number, move_date, arrival_window, survey_at, stage, ' +
        'company:companies(name), ' +
        'customer:customers(id, customer_type, first_name, last_name, company_name, primary_email), ' +
        'job_addresses(role, address:addresses(line1, line2, city, postcode))',
    )
    .eq('id', payload.job_id)
    .maybeSingle();
  if (!data) return empty;
  // Multi-embed selects confuse the generated types (GenericStringError); the
  // PostgREST query is valid at runtime, so narrow via unknown.
  const raw = data as unknown as Record<string, unknown>;

  const c = Array.isArray(raw.customer) ? raw.customer[0] : raw.customer;
  const customer = (c ?? null) as CustomerRow | null;
  const company = (Array.isArray(raw.company) ? raw.company[0] : raw.company) as {
    name: string | null;
  } | null;
  const addressRows = (raw.job_addresses ?? []) as Array<{
    role: string | null;
    address: AddressParts | AddressParts[] | null;
  }>;

  const vars = buildTemplateVars({
    jobNumber: (raw.job_number as string) ?? null,
    moveDate: (raw.move_date as string) ?? null,
    arrivalWindow: (raw.arrival_window as string) ?? null,
    surveyAt: (raw.survey_at as string) ?? null,
    fromStage: payload.from ?? null,
    toStage: payload.to ?? null,
    customer,
    senderCompanyName: company?.name ?? null,
    currentAddress: pickAddress(addressRows, 'from'),
    newAddress: pickAddress(addressRows, 'to'),
  });

  return {
    vars,
    email: customer?.primary_email ?? null,
    customerId: customer?.id ?? null,
    currentStage: (raw.stage as string) ?? null,
  };
}

export async function runAutomationQueue(now: Date = new Date()): Promise<AutomationResult> {
  const supabase = createAdminClient();
  const result: AutomationResult = { due: 0, sent: 0, skipped: 0, failed: 0 };

  const { data: rows } = await supabase
    .from('automation_queue')
    .select('id, company_id, rule_id, payload')
    .is('processed_at', null)
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(MAX);

  const queue = (rows ?? []) as Array<{
    id: string;
    company_id: string;
    rule_id: string;
    payload: { job_id?: string; from?: string; to?: string } | null;
  }>;
  result.due = queue.length;

  for (const row of queue) {
    const finish = async (outcome: 'success' | 'failed' | 'skipped', error?: string) => {
      await supabase
        .from('automation_queue')
        .update({ processed_at: now.toISOString(), result: outcome, error_message: error ?? null })
        .eq('id', row.id);
    };

    try {
      const { data: ruleRow } = await supabase
        .from('automation_rules')
        .select('action_type, action_config, run_count')
        .eq('id', row.rule_id)
        .maybeSingle();
      const rule = ruleRow as {
        action_type: string;
        action_config: { template_id?: string; requires_stage?: string } | null;
        run_count: number | null;
      } | null;

      if (!rule || rule.action_type !== 'send_email') {
        result.skipped += 1;
        await finish(
          'skipped',
          rule ? `action ${rule.action_type} not yet supported` : 'rule missing',
        );
        continue;
      }

      const templateId = rule.action_config?.template_id;
      const { data: tmpl } = templateId
        ? await supabase
            .from('email_templates')
            .select('subject_template, body_template')
            .eq('id', templateId)
            .maybeSingle()
        : { data: null };
      const template = tmpl as { subject_template: string; body_template: string } | null;
      const { vars, email, customerId, currentStage } = await buildVars(supabase, row.payload ?? {});

      // Dwell-guard (ADR-024): a delayed rule may require the job to still be in
      // a given stage. If the job has moved on (customer replied/accepted), the
      // queued follow-up is superseded — skip it rather than send a stale email.
      const requiresStage = rule.action_config?.requires_stage;
      if (requiresStage && currentStage !== requiresStage) {
        result.skipped += 1;
        await finish('skipped', 'superseded');
        continue;
      }

      if (!template || !email) {
        result.skipped += 1;
        await finish('skipped', !template ? 'template missing' : 'no recipient email');
        continue;
      }

      const subject = renderTemplate(template.subject_template, vars);
      const body = renderTemplate(template.body_template, vars);
      const messageId = await sendAutomationEmail({ to: email, subject, text: body });

      await supabase.from('messages').insert({
        company_id: row.company_id,
        customer_id: customerId,
        job_id: row.payload?.job_id ?? null,
        channel: 'email',
        direction: 'outbound',
        template_id: templateId ?? null,
        subject,
        body,
        provider: 'resend',
        provider_message_id: messageId,
        status: 'sent',
        to_address: email,
      });
      await supabase
        .from('automation_rules')
        .update({ run_count: (rule.run_count ?? 0) + 1, last_run_at: now.toISOString() })
        .eq('id', row.rule_id);

      result.sent += 1;
      await finish('success');
    } catch (err) {
      result.failed += 1;
      await finish('failed', err instanceof Error ? err.message.slice(0, 200) : 'unknown');
    }
  }

  return result;
}
