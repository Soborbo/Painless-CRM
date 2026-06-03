import { requireRole } from '@/lib/auth/require-role';
import { TRIGGER_EVENT_LABELS, type TriggerEvent } from '@/lib/comms/automation';
import { type FlowEmail, buildFlowModel } from '@/lib/comms/automation-flow';
import { listAutomationRules } from '@/lib/queries/automation-rules';
import { listEmailTemplates } from '@/lib/queries/templates';
import Link from 'next/link';

const RULE_ROLES = ['manager', 'admin', 'super_admin'] as const;

// The customer-facing funnel (forward path), then the lost outcomes.
const FUNNEL = [
  'lead',
  'contacted',
  'survey_scheduled',
  'quoted',
  'accepted',
  'confirmed',
  'in_progress',
  'completed',
  'invoiced',
  'paid',
] as const;
const LOST = ['declined', 'dead', 'cancelled'] as const;
const EVENT_LANE: TriggerEvent[] = ['job.created', 'invoice.created', 'payment.recorded'];
const label = (s: string) => s.replace(/_/g, ' ');

function Chip({ email }: { email: FlowEmail }) {
  return (
    <Link
      href={`/dashboard/settings/automations/${email.ruleId}`}
      className={`flex flex-col gap-0.5 rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)] ${
        email.active ? '' : 'opacity-50'
      }`}
    >
      <span className="font-medium">{email.templateName}</span>
      <span className="flex flex-wrap gap-1 text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {email.delayLabel ? <span className="rounded bg-[var(--color-muted)] px-1">{email.delayLabel}</span> : null}
        {email.dwell ? <span className="rounded bg-[var(--color-muted)] px-1">auto-cancel</span> : null}
        {email.serviceType ? <span className="rounded bg-[var(--color-muted)] px-1">{label(email.serviceType)}</span> : null}
        {email.kind ? <span className="rounded bg-[var(--color-muted)] px-1">{email.kind}</span> : null}
        {email.active ? null : <span className="rounded bg-[var(--color-muted)] px-1">inactive</span>}
      </span>
    </Link>
  );
}

function StageRow({ name, emails }: { name: string; emails: FlowEmail[] }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-40 shrink-0 rounded-md border bg-[var(--color-muted)]/30 px-3 py-2 text-sm font-medium capitalize">
        {label(name)}
      </div>
      <div className="flex flex-1 flex-wrap gap-2 py-1">
        {emails.length ? (
          emails.map((e) => <Chip key={e.ruleId} email={e} />)
        ) : (
          <span className="py-1 text-xs text-[var(--color-muted-foreground)]">no email</span>
        )}
      </div>
    </div>
  );
}

export default async function AutomationFlowPage() {
  await requireRole(RULE_ROLES);
  const [rules, templates] = await Promise.all([listAutomationRules(), listEmailTemplates()]);
  const names = new Map(templates.map((t) => [t.id, t.name] as const));
  const model = buildFlowModel(rules, names);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Email flow</h1>
        <Link href="/dashboard/settings/automations" className="text-sm hover:underline">
          Manage rules →
        </Link>
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        Which email goes out when, as a job moves through the pipeline. Click any email to edit when
        it fires. Badges: delay, <em>auto-cancel</em> (skipped if the customer has moved on),
        service type, and invoice type.
      </p>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Pipeline
        </h2>
        <div className="flex flex-col">
          {FUNNEL.map((stage, i) => (
            <div key={stage} className="flex flex-col">
              <StageRow name={stage} emails={model.byStage[stage] ?? []} />
              {i < FUNNEL.length - 1 ? (
                <div className="ml-20 h-4 w-px bg-[var(--color-border,#e5e7eb)]" aria-hidden />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          If the job is lost
        </h2>
        <div className="flex flex-col gap-3">
          {LOST.map((stage) => (
            <StageRow key={stage} name={stage} emails={model.byStage[stage] ?? []} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Events (not stage-driven)
        </h2>
        <div className="flex flex-col gap-3">
          {EVENT_LANE.map((event) => (
            <StageRow key={event} name={TRIGGER_EVENT_LABELS[event]} emails={model.byEvent[event] ?? []} />
          ))}
        </div>
      </section>
    </main>
  );
}
