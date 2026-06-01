import { requireUser } from '@/lib/auth/require-role';
import {
  getAssignedVehicle,
  getWorkerForUser,
  getWorkerJobDetail,
  hasVehicleCheck,
} from '@/lib/queries/worker-app';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VehicleCheckForm } from './check-form';

type Props = { params: Promise<{ id: string }> };

export default async function VehicleCheckPage({ params }: Props) {
  const { id } = await params;
  const me = await requireUser();
  const worker = await getWorkerForUser(me.id);
  if (!worker) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const job = await getWorkerJobDetail(id, worker.id, today);
  if (!job) notFound();

  const vehicle = await getAssignedVehicle(worker.id, id);
  const t = await getTranslations('workerApp');

  return (
    <main className="flex flex-col gap-5">
      <header>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          <Link href={`/jobs/${id}`} className="hover:underline">
            ← {job.job_number}
          </Link>
        </p>
        <h1 className="mt-1 text-xl font-semibold">{t('check.heading')}</h1>
        {vehicle ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">{vehicle.registration}</p>
        ) : null}
      </header>

      {!vehicle ? (
        <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-6 text-sm text-[var(--color-muted-foreground)]">
          {t('check.noVehicle')}
        </p>
      ) : (await hasVehicleCheck(worker.id, vehicle.vehicle_id, id, today)) ? (
        <p className="rounded-md bg-[var(--color-success,#16a34a)]/15 px-3 py-2 text-sm text-[var(--color-success,#16a34a)]">
          {t('check.alreadyDone')}
        </p>
      ) : (
        <VehicleCheckForm
          jobId={id}
          vehicleId={vehicle.vehicle_id}
          registration={vehicle.registration}
        />
      )}
    </main>
  );
}
