import { SortableHeader } from '@/components/ui/sortable-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

export async function VehicleTable({
  rows,
  sort,
  dir,
  params,
}: {
  rows: VehicleRow[];
  sort?: string;
  dir?: 'asc' | 'desc';
  params?: Record<string, string | undefined>;
}) {
  const t = await getTranslations('vehicles');
  const today = new Date();

  if (rows.length === 0) {
    return (
      <p className="rounded-md border bg-[var(--color-muted)]/40 px-4 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
        {t('emptyList')}
      </p>
    );
  }

  const sortProps = { sort, dir, params };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-[var(--color-muted)]">
          <TableRow>
            <TableHead>
              <SortableHeader
                label={t('columns.registration')}
                column="registration"
                {...sortProps}
              />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('columns.type')} column="type" {...sortProps} />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('columns.capacity')}
                column="capacity_cubic_ft"
                {...sortProps}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('columns.monthlyCost')}
                column="monthly_cost_pence"
                {...sortProps}
              />
            </TableHead>
            <TableHead>{t('columns.compliance')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                <Link href={`/dashboard/vehicles/${row.id}`} className="hover:underline">
                  {row.registration}
                </Link>
                {!row.active ? (
                  <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                    ({t('inactiveBadge')})
                  </span>
                ) : null}
              </TableCell>
              <TableCell>{row.type ? t(`types.${row.type.replace('.', '_')}`) : '—'}</TableCell>
              <TableCell>
                {row.capacity_cubic_ft != null ? `${row.capacity_cubic_ft} ft³` : '—'}
              </TableCell>
              <TableCell>{formatPence(row.monthly_cost_pence)}</TableCell>
              <TableCell>
                {(() => {
                  const state = worstState(row, today);
                  return <ComplianceBadge state={state} text={t(`complianceState.${state}`)} />;
                })()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
