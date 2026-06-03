import { sendDunningEmail } from '@/lib/integrations/resend/dunning';
import { createAdminClient } from '@/lib/supabase/admin';
import { customerDisplayName } from '@/lib/utils/format';
import { formatPence } from '@/lib/utils/format';
import { type DunningStage, daysOverdue, dunningStage, shouldMarkOverdue } from './dunning';

// Daily dunning sweep (Phase 12 §9). Marks past-due invoices overdue and emails
// the customer at each cadence mark (T+3/7/14), escalating to the company's
// managers at T+30. Stateless — the pure stage logic fires each stage once.
// Service-role client (no user). Resend degrades to a log without a key.

const MAX = 2000;

const SELECT =
  'id, company_id, invoice_number, status, due_at, amount_outstanding_pence, version, ' +
  'customer:customers(customer_type, first_name, last_name, company_name, primary_email)';

const COPY: Record<Exclude<DunningStage, 'none' | 'admin'>, { subject: string; body: string }> = {
  reminder1: {
    subject: 'A friendly reminder about your invoice',
    body: 'Just a friendly reminder that your invoice',
  },
  reminder2: {
    subject: 'Second reminder — invoice outstanding',
    body: 'This is a second reminder that your invoice',
  },
  urgent: {
    subject: 'Urgent: invoice overdue',
    body: 'Your invoice is now significantly overdue —',
  },
};

export interface DunningResult {
  scanned: number;
  markedOverdue: number;
  remindersSent: number;
  escalated: number;
}

function embed<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T) ?? null;
  return (raw as T) ?? null;
}

// Idempotency ledger (audit M4): claim (invoice, stage) before sending. Returns
// true only for the first claim — the unique(invoice_id, stage) index turns a
// repeat into a 23505, so a same-day re-run or a missed-then-caught-up day never
// re-sends. On any other DB error we DON'T send (safer than risking a dupe).
async function claimDunningStage(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
  invoiceId: string,
  stage: DunningStage,
): Promise<boolean> {
  const { error } = await supabase
    .from('dunning_log')
    .insert({ company_id: companyId, invoice_id: invoiceId, stage });
  return !error;
}

export async function runDunningSweep(now: Date = new Date()): Promise<DunningResult> {
  const supabase = createAdminClient();
  const result: DunningResult = { scanned: 0, markedOverdue: 0, remindersSent: 0, escalated: 0 };

  const { data: rows } = await supabase
    .from('invoices')
    .select(SELECT)
    .in('status', ['sent', 'partial', 'overdue'])
    .not('due_at', 'is', null)
    .gt('amount_outstanding_pence', 0)
    .is('deleted_at', null)
    .limit(MAX);

  const invoices = (rows ?? []) as unknown as Array<Record<string, unknown>>;
  result.scanned = invoices.length;
  const escalateByCompany = new Map<string, number>();

  for (const inv of invoices) {
    const dueAt = inv.due_at as string;
    const days = daysOverdue(dueAt, now);
    if (days < 1) continue;

    const status = inv.status as string;
    if (shouldMarkOverdue(status, days)) {
      await supabase
        .from('invoices')
        .update({ status: 'overdue', version: (inv.version as number) + 1 })
        .eq('id', inv.id as string)
        .eq('version', inv.version as number);
      result.markedOverdue += 1;
    }

    const stage = dunningStage(days);
    if (stage === 'none') continue;
    if (stage === 'admin') {
      // Claim per-invoice so a company is only escalated once per overdue
      // invoice, not re-counted on every daily run.
      const claimed = await claimDunningStage(
        supabase,
        inv.company_id as string,
        inv.id as string,
        'admin',
      );
      if (claimed) {
        escalateByCompany.set(
          inv.company_id as string,
          (escalateByCompany.get(inv.company_id as string) ?? 0) + 1,
        );
      }
      continue;
    }

    const customer = embed<
      Parameters<typeof customerDisplayName>[0] & { primary_email: string | null }
    >(inv.customer);
    const email = customer?.primary_email;
    if (!email) continue;
    // Claim this stage before emailing — skips if already sent (audit M4).
    const claimed = await claimDunningStage(
      supabase,
      inv.company_id as string,
      inv.id as string,
      stage,
    );
    if (!claimed) continue;
    const copy = COPY[stage];
    await sendDunningEmail({
      to: email,
      subject: copy.subject,
      text: `Hi ${customerDisplayName(customer)},\n\n${copy.body} ${inv.invoice_number} for ${formatPence(
        (inv.amount_outstanding_pence as number) ?? 0,
      )} is outstanding. Please get in touch or arrange payment.\n\nThank you,\nPainless Removals`,
    });
    result.remindersSent += 1;
  }

  // T+30 → notify each company's managers/admins.
  for (const [companyId, count] of escalateByCompany) {
    const { data: admins } = await supabase
      .from('users')
      .select('email')
      .eq('company_id', companyId)
      .in('role', ['manager', 'admin'])
      .eq('active', true);
    const recipients = ((admins ?? []) as Array<{ email: string }>)
      .map((a) => a.email)
      .filter(Boolean);
    for (const to of recipients) {
      await sendDunningEmail({
        to,
        subject: `${count} invoice(s) 30+ days overdue`,
        text: `${count} invoice(s) are now 30+ days overdue and need attention.`,
      });
    }
    result.escalated += count;
  }

  return result;
}
