import { requireUser } from '@/lib/auth/require-role';
import { getVehicleById } from '@/lib/queries/vehicles';
import { formatDate, formatPence } from '@/lib/utils/format';
import { complianceStatus } from '@/lib/vehicles/compliance';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ComplianceBadge } from '../vehicle-table';
import { DeleteVehicleButton } from './delete-button';

type Props = { params: Promise<{ id: string }> };

const ADMIN_ROLES = ['admin', 'super_admin'] as const;
const MANAGE_ROLES = ['manager', 'admin', 'super_admin'] as const;

export default async function VehicleDetailPage({ params }: Props) {
  const { id } = await params;
  const me = await requireUser();
  if (!(MANAGE_ROLES as readonly string[]).includes(me.role)) {
    notFound();
  }
  const vehicle = await getVehicleById(id);
  if (!vehicle) notFound();

  const t = await getTranslations('vehicles');
  const isAdmin = (ADMIN_ROLES as readonly string[]).includes(me.role);
  const today = new Date();

  const complianceRows = [
    { key: 'motDue', date: vehicle.mot_due },
    { key: 'taxDue', date: vehicle.tax_due },
    { key: 'insuranceDue', date: vehicle.insurance_due },
    { key: 'nextServiceDue', date: vehicle.next_service_due },
  ] as const;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            <Link href="/dashboard/vehicles" className="hover:underline">
              {t('title')}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{vehicle.registration}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {vehicle.type ? t(`types.${vehicle.type.replace('.', '_')}`) : '—'}
            {!vehicle.active ? ` · ${t('inactiveBadge')}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/vehicles/${id}/edit`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('edit')}
          </Link>
          {isAdmin ? <DeleteVehicleButton id={vehicle.id} version={vehicle.version} /> : null}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Detail label={t('fields.capacityCubicFt')}>
          {vehicle.capacity_cubic_ft != null ? `${vehicle.capacity_cubic_ft} ft³` : '—'}
        </Detail>
        <Detail label={t('fields.monthlyCostPounds')}>
          {formatPence(vehicle.monthly_cost_pence)}
        </Detail>
        <Detail label={t('fields.complianceAlertsEnabled')}>
          {vehicle.compliance_alerts_enabled ? t('enabled') : t('disabled')}
        </Detail>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">{t('complianceLegend')}</h2>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-left text-sm">
            <tbody>
              {complianceRows.map((row) => {
                const status = complianceStatus(row.date, today);
                return (
                  <tr key={row.key} className="border-t first:border-t-0">
                    <td className="px-3 py-2 font-medium">{t(`fields.${row.key}`)}</td>
                    <td className="px-3 py-2">{formatDate(row.date)}</td>
                    <td className="px-3 py-2">
                      {status.daysUntil !== null ? (
                        <span className="text-[var(--color-muted-foreground)]">
                          {status.daysUntil < 0
                            ? t('overdueByDays', { days: Math.abs(status.daysUntil) })
                            : t('inDays', { days: status.daysUntil })}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <ComplianceBadge
                        state={status.state}
                        text={t(`complianceState.${status.state}`)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}
