import { BarChart } from '@/components/charts/bar';
import type { StorageReport } from '@/lib/reports/storage';
import { formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';

export async function StorageAnalytics({ report }: { report: StorageReport }) {
  const t = await getTranslations('analytics');

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={t('activeRentals')} value={String(report.activeRentals)} />
        <Tile label={t('mrr')} value={formatPence(report.mrrPence)} />
        <Tile label={t('pendingMrr')} value={formatPence(report.pendingMrrPence)} />
        <Tile
          label={t('churnRate')}
          value={report.churnRatePct === null ? '—' : `${report.churnRatePct.toFixed(1)}%`}
        />
      </div>

      <section className="rounded-md border p-4">
        <h2 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('mrrMovement')}
        </h2>
        <div className="mt-3">
          <BarChart
            data={[
              { label: t('newMrr'), value: report.newMrrPence },
              { label: t('churnedMrr'), value: report.churnedMrrPence },
            ]}
            formatValue={formatPence}
          />
          <p className="mt-3 text-sm">
            {t('netMrr')}:{' '}
            <span className="font-semibold tabular-nums">
              {formatPence(report.netMrrChangePence)}
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
