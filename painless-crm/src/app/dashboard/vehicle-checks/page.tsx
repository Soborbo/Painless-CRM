import { requireRole } from '@/lib/auth/require-role';
import { listRecentVehicleChecks } from '@/lib/queries/vehicle-checks';
import { countNeedingAttention } from '@/lib/worker/vehicle-check-view';
import { getTranslations } from 'next-intl/server';
import { RealtimeRefresh } from './realtime-refresh';
import { VehicleChecksTable } from './vehicle-checks-table';

const ROLES = ['manager', 'admin', 'super_admin'] as const;

export default async function VehicleChecksPage() {
  await requireRole(ROLES);
  const [checks, t] = await Promise.all([
    listRecentVehicleChecks(),
    getTranslations('vehicleChecks'),
  ]);
  const attention = countNeedingAttention(checks);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <RealtimeRefresh />
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        {attention > 0 ? (
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
            {t('attentionCount', { count: attention })}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>

      <div className="mt-6">
        <VehicleChecksTable rows={checks} />
      </div>
    </main>
  );
}
