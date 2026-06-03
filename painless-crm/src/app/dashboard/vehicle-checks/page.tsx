import { requireRole } from '@/lib/auth/require-role';
import { listRecentVehicleChecks } from '@/lib/queries/vehicle-checks';
import { formatDateTime } from '@/lib/utils/format';
import { countNeedingAttention, vehicleCheckFlags } from '@/lib/worker/vehicle-check-view';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { RealtimeRefresh } from './realtime-refresh';

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

      {checks.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-muted-foreground)]">{t('none')}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-[var(--color-muted)]/30 text-left text-xs text-[var(--color-muted-foreground)]">
              <tr>
                <th className="p-3 font-medium">{t('colSubmitted')}</th>
                <th className="p-3 font-medium">{t('colVehicle')}</th>
                <th className="p-3 font-medium">{t('colWorker')}</th>
                <th className="p-3 font-medium">{t('colJob')}</th>
                <th className="p-3 font-medium">{t('colFuel')}</th>
                <th className="p-3 font-medium">{t('colMileage')}</th>
                <th className="p-3 font-medium">{t('colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {checks.map((c) => {
                const flags = vehicleCheckFlags(c);
                return (
                  <tr key={c.id} className={flags.needsAttention ? 'bg-red-50/50' : undefined}>
                    <td className="p-3 whitespace-nowrap">{formatDateTime(c.submitted_at)}</td>
                    <td className="p-3 font-medium">{c.registration}</td>
                    <td className="p-3">{c.worker_name}</td>
                    <td className="p-3">
                      {c.job_id && c.job_number ? (
                        <Link href={`/dashboard/jobs/${c.job_id}`} className="hover:underline">
                          {c.job_number}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3">
                      {c.fuel_level == null ? (
                        '—'
                      ) : (
                        <span className={flags.lowFuel ? 'font-medium text-red-700' : undefined}>
                          {c.fuel_level}%
                        </span>
                      )}
                    </td>
                    <td className="p-3">{c.mileage == null ? '—' : c.mileage.toLocaleString()}</td>
                    <td className="p-3">
                      {flags.needsAttention ? (
                        <span className="text-red-700">
                          {flags.failedWalkAround
                            ? t('statusDefects')
                            : flags.hasDefects
                              ? t('statusDefects')
                              : t('statusLowFuel')}
                          {c.defects_noted ? ` — ${c.defects_noted}` : ''}
                        </span>
                      ) : (
                        <span className="text-emerald-700">{t('statusClear')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
