import { requireRole } from '@/lib/auth/require-role';
import { listAutomationRules } from '@/lib/queries/automation-rules';
import Link from 'next/link';

const RULE_ROLES = ['manager', 'admin', 'super_admin'] as const;

export default async function AutomationsPage() {
  await requireRole(RULE_ROLES);
  const rules = await listAutomationRules();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Automations</h1>
        <Link
          href="/dashboard/settings/automations/new"
          className="rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)]"
        >
          New rule
        </Link>
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        When a job changes stage, send a templated email after an optional delay.
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
                  {r.from_stage ?? 'any'} → {r.to_stage ?? 'any'}
                  {r.delay_seconds > 0 ? ` · +${Math.round(r.delay_seconds / 60)}m` : ''}
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
