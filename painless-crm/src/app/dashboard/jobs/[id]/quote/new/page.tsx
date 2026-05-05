import { ManualQuoteForm } from '@/components/domain/job/manual-quote-form';
import { requireRole } from '@/lib/auth/require-role';
import { getJobById } from '@/lib/queries/jobs';
import { getActivePricingVersion } from '@/lib/queries/pricing';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

export default async function NewQuotePage({ params }: Props) {
  const { id } = await params;
  await requireRole(['sales', 'manager', 'admin', 'super_admin']);
  const t = await getTranslations('quotes');

  const [job, active] = await Promise.all([getJobById(id), getActivePricingVersion()]);
  if (!job) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <nav className="text-sm text-[var(--color-muted-foreground)]">
        <Link href={`/dashboard/jobs/${id}`} className="hover:underline">
          {job.job_number}
        </Link>
        <span className="mx-1.5">/</span>
        <span>{t('builderTitle')}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('builderTitle')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('builderSubtitle')}</p>
      </header>

      {active ? (
        <ManualQuoteForm
          jobId={id}
          options={{
            size_categories: active.config.size_categories,
            complications: active.config.complications,
            version_label: active.version_label,
          }}
        />
      ) : (
        <div className="rounded-md border border-dashed p-6 text-sm">
          <p>{t('builderNoActive')}</p>
          <Link href="/dashboard/settings/pricing" className="mt-2 inline-block text-sm underline">
            {t('builderGoToPricing')}
          </Link>
        </div>
      )}
    </main>
  );
}
