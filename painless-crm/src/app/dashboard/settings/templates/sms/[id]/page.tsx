import { requireRole } from '@/lib/auth/require-role';
import { getSmsTemplate } from '@/lib/queries/templates';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SmsTemplateForm } from '../../template-sms-form';

const TEMPLATE_ROLES = ['manager', 'admin', 'super_admin'] as const;

type Props = { params: Promise<{ id: string }> };

export default async function EditSmsTemplatePage({ params }: Props) {
  await requireRole(TEMPLATE_ROLES);
  const { id } = await params;
  const template = await getSmsTemplate(id);
  if (!template) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link href="/dashboard/settings/templates" className="hover:underline">
          ← Templates
        </Link>
      </p>
      <h1 className="mt-1 mb-6 text-xl font-semibold">Edit SMS template</h1>
      <SmsTemplateForm template={template} />
    </main>
  );
}
