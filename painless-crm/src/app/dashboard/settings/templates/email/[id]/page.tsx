import { requireRole } from '@/lib/auth/require-role';
import { getEmailTemplate } from '@/lib/queries/templates';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmailTemplateForm } from '../../template-email-form';

const TEMPLATE_ROLES = ['manager', 'admin', 'super_admin'] as const;

type Props = { params: Promise<{ id: string }> };

export default async function EditEmailTemplatePage({ params }: Props) {
  await requireRole(TEMPLATE_ROLES);
  const { id } = await params;
  const template = await getEmailTemplate(id);
  if (!template) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link href="/dashboard/settings/templates" className="hover:underline">
          ← Templates
        </Link>
      </p>
      <h1 className="mt-1 mb-6 text-xl font-semibold">Edit email template</h1>
      <EmailTemplateForm template={template} />
    </main>
  );
}
