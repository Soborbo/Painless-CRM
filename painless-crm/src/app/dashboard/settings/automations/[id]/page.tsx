import { requireRole } from '@/lib/auth/require-role';
import { getAutomationRule } from '@/lib/queries/automation-rules';
import { listEmailTemplates } from '@/lib/queries/templates';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutomationForm } from '../automation-form';

const RULE_ROLES = ['manager', 'admin', 'super_admin'] as const;

type Props = { params: Promise<{ id: string }> };

export default async function EditAutomationPage({ params }: Props) {
  await requireRole(RULE_ROLES);
  const { id } = await params;
  const [rule, templates] = await Promise.all([getAutomationRule(id), listEmailTemplates()]);
  if (!rule) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link href="/dashboard/settings/automations" className="hover:underline">
          ← Automations
        </Link>
      </p>
      <h1 className="mt-1 mb-6 text-xl font-semibold">Edit automation rule</h1>
      <AutomationForm rule={rule} templates={templates.map((t) => ({ id: t.id, name: t.name }))} />
    </main>
  );
}
