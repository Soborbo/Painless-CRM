import { requireRole } from '@/lib/auth/require-role';
import { getCustomerById } from '@/lib/queries/customers';
import { listSalesReps } from '@/lib/queries/jobs';
import { customerDisplayName } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { NewJobForm } from './new-job-form';

type Props = { searchParams: Promise<{ customer_id?: string }> };

export default async function NewJobPage({ searchParams }: Props) {
  await requireRole(['sales', 'manager', 'admin', 'super_admin']);
  const { customer_id } = await searchParams;
  const t = await getTranslations('jobs');

  if (!customer_id) {
    redirect('/dashboard/customers?next=new-job');
  }

  const [customer, reps] = await Promise.all([getCustomerById(customer_id), listSalesReps()]);

  if (!customer) redirect('/dashboard/customers');

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('newJob')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {t('newJobFor', { name: customerDisplayName(customer) })}
        </p>
      </header>

      <NewJobForm
        customerId={customer.id}
        reps={reps.map((r) => ({ id: r.id, full_name: r.full_name }))}
      />
    </main>
  );
}
