import { requireRole } from '@/lib/auth/require-role';
import Link from 'next/link';
import { SmsTemplateForm } from '../../template-sms-form';

const TEMPLATE_ROLES = ['manager', 'admin', 'super_admin'] as const;

export default async function NewSmsTemplatePage() {
  await requireRole(TEMPLATE_ROLES);
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link href="/dashboard/settings/templates" className="hover:underline">
          ← Templates
        </Link>
      </p>
      <h1 className="mt-1 mb-6 text-xl font-semibold">New SMS template</h1>
      <SmsTemplateForm />
    </main>
  );
}
