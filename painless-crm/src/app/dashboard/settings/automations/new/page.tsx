import { requireRole } from '@/lib/auth/require-role';
import { listEmailTemplates } from '@/lib/queries/templates';
import Link from 'next/link';
import { AutomationForm } from '../automation-form';

const RULE_ROLES = ['manager', 'admin', 'super_admin'] as const;

export default async function NewAutomationPage() {
  await requireRole(RULE_ROLES);
  const templates = await listEmailTemplates();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link href="/dashboard/settings/automations" className="hover:underline">
          ← Automations
        </Link>
      </p>
      <h1 className="mt-1 mb-6 text-xl font-semibold">New automation rule</h1>
      <AutomationForm templates={templates.map((t) => ({ id: t.id, name: t.name }))} />
    </main>
  );
}
