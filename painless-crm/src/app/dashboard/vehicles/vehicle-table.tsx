import type { VehicleRow } from '@/lib/queries/vehicles';
import { formatPence } from '@/lib/utils/format';
import { type ComplianceState, complianceStatus } from '@/lib/vehicles/compliance';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

// Worst compliance state across a vehicle's four due-dates, for the list badge.
const SEVERITY: Record<ComplianceState, number> = { expired: 3, 'due-soon': 2, ok: 1, none: 0 };

function worstState(vehicle: VehicleRow, today: Date): ComplianceState {
  const states = [
    vehicle.mot_due,
    vehicle.tax_due,
    vehicle.insurance_due,
    vehicle.next_service_due,
  ].map((d) => complianceStatus(d, today).state);
  return states.reduce<ComplianceState>(
    (worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst),
    'none',
  );
}

export async function VehicleTable({ rows }: { rows: VehicleRow[] }) {
  const t = await getTranslations('vehicles');
  const today = new Date();

  if (rows.length === 0) {
    return (
      <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
        {t('emptyList')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--color-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">{t('columns.registration')}</th>
            <th className="px-3 py-2 font-medium">{t('columns.type')}</th>
            <th className="px-3 py-2 font-medium">{t('columns.capacity')}</th>
            <th className="px-3 py-2 font-medium">{t('columns.monthlyCost')}</th>
            <th className="px-3 py-2 font-medium">{t('columns.compliance')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t hover:bg-[var(--color-muted)]/40">
              <td className="px-3 py-2 font-medium">
                <Link href={`/dashboard/vehicles/${row.id}`} className="hover:underline">
                  {row.registration}
                </Link>
                {!row.active ? (
                  <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                    ({t('inactiveBadge')})
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2">{row.type ? t(`types.${row.type}`) : '—'}</td>
              <td className="px-3 py-2">
                {row.capacity_cubic_ft != null ? `${row.capacity_cubic_ft} ft³` : '—'}
              </td>
              <td className="px-3 py-2">{formatPence(row.monthly_cost_pence)}</td>
              <td className="px-3 py-2">
                {(() => {
                  const state = worstState(row, today);
                  return <ComplianceBadge state={state} text={t(`complianceState.${state}`)} />;
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ComplianceBadge({ state, text }: { state: ComplianceState; text: string }) {
  const styles: Record<ComplianceState, string> = {
    expired: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
    'due-soon': 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
    ok: 'bg-[var(--color-success,#16a34a)]/15 text-[var(--color-success,#16a34a)]',
    none: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[state]}`}>{text}</span>
  );
}
