import { requireRole } from '@/lib/auth/require-role';
import { TRIGGER_EVENT_LABELS, type TriggerEvent } from '@/lib/comms/automation';
import { formatDelay } from '@/lib/comms/automation-flow';
import { type AutomationRuleRow, listAutomationRules } from '@/lib/queries/automation-rules';
import Link from 'next/link';

const RULE_ROLES = ['manager', 'admin', 'super_admin'] as const;
const label = (s: string) => s.replace(/_/g, ' ');

// One-line description of when a rule fires.
function triggerSummary(r: AutomationRuleRow): string {
  const parts: string[] = [
    TRIGGER_EVENT_LABELS[r.trigger_event as TriggerEvent] ?? r.trigger_event,
  ];
  if (r.trigger_event === 'job.stage_changed') {
    parts.push(`→ ${label(r.to_stage ?? 'any')}`);
    if (r.service_type) parts.push(`(${label(r.service_type)})`);
  } else if (r.kind) {
    parts.push(`(${r.kind})`);
  }
  const delay = formatDelay(r.delay_seconds);
  if (delay) parts.push(`· ${delay}`);
  if (r.requires_stage) parts.push('· auto-cancel');
  return parts.join(' ');
}

export default async function AutomationsPage() {
  await requireRole(RULE_ROLES);
  const rules = await listAutomationRules();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Automations</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/settings/automations/flow"
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-muted)]"
          >
            View flowchart
          </Link>
          <Link
            href="/dashboard/settings/automations/new"
            className="rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)]"
          >
            New rule
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        Choose which email goes out when — on stage changes, new enquiries, invoices and payments.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {rules.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">No rules yet.</p>
        ) : (
          rules.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/settings/automations/${r.id}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-[var(--color-muted)]"
            >
              <span>
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-[var(--color-muted-foreground)]">
                  {triggerSummary(r)}
                </span>
              </span>
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {r.active ? `${r.run_count} runs` : 'inactive'}
              </span>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
