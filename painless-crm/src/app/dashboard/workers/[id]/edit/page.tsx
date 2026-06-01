import { WorkerForm } from '@/components/domain/worker/worker-form';
import { requireRole } from '@/lib/auth/require-role';
import { getWorkerById } from '@/lib/queries/workers';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

export default async function EditWorkerPage({ params }: Props) {
  const { id } = await params;
  await requireRole(['manager', 'admin', 'super_admin']);
  const worker = await getWorkerById(id);
  if (!worker) notFound();

  const t = await getTranslations('workers');

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('edit')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{worker.full_name}</p>
      </header>
      <WorkerForm
        mode="edit"
        id={worker.id}
        version={worker.version}
        defaults={{
          full_name: worker.full_name,
          phone: worker.phone ?? '',
          email: worker.email ?? '',
          hourly_rate_pounds:
            worker.hourly_rate_pence != null ? (worker.hourly_rate_pence / 100).toFixed(2) : '',
          skills: worker.skills ?? '',
          active: worker.active,
          notes: worker.notes ?? '',
        }}
      />
    </main>
  );
}
