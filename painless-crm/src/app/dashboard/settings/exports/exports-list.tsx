import { type ExportLogRow, summarizeFilters } from '@/lib/queries/export-log';
import { formatDateTime } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';

export async function ExportsList({ rows }: { rows: ExportLogRow[] }) {
  const t = await getTranslations('exports');

  if (rows.length === 0) {
    return <p className="text-sm text-[var(--color-muted-foreground)]">{t('empty')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--color-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">{t('when')}</th>
            <th className="px-3 py-2 font-medium">{t('resource')}</th>
            <th className="px-3 py-2 font-medium">{t('format')}</th>
            <th className="px-3 py-2 text-right font-medium">{t('rows')}</th>
            <th className="px-3 py-2 font-medium">{t('actor')}</th>
            <th className="px-3 py-2 font-medium">{t('filters')}</th>
            <th className="px-3 py-2 font-medium">{t('ip')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const summary = summarizeFilters(row.filters);
            return (
              <tr key={row.id} className="border-t align-top">
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(row.exported_at)}</td>
                <td className="px-3 py-2">{row.resource}</td>
                <td className="px-3 py-2 uppercase">{row.format}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.row_count}</td>
                <td className="px-3 py-2">
                  {row.actor_name ?? row.actor_email ?? (
                    <span className="text-[var(--color-muted-foreground)]">
                      {t('unknownActor')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-[var(--color-muted-foreground)]">{summary || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                  {row.ip_address ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
