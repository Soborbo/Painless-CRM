import { listRentalsForCustomer } from '@/lib/queries/storage-rental';
import { summarizeCustomerRentals } from '@/lib/storage/customer-rentals';
import { isRentalStatus } from '@/lib/storage/rental-lifecycle';
import { formatDate, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

// Customer 360 storage panel. Self-fetching so the customer page stays lean;
// renders nothing when the customer has never had a storage rental.
export async function StorageRentalsSection({ customerId }: { customerId: string }) {
  const rentals = await listRentalsForCustomer(customerId);
  if (rentals.length === 0) return null;

  const [t, ts] = await Promise.all([getTranslations('customers'), getTranslations('storage')]);
  const summary = summarizeCustomerRentals(rentals);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{t('storageSection')}</h2>
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {t('storageSummary', {
            count: summary.activeCount,
            total: formatPence(summary.monthlyTotalPence),
          })}
        </span>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--color-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">{ts('fields.containerCode')}</th>
              <th className="px-3 py-2 font-medium">{ts('fields.name')}</th>
              <th className="px-3 py-2 font-medium">{ts('rentalStatus')}</th>
              <th className="px-3 py-2 font-medium">{ts('fields.monthlyRatePounds')}</th>
              <th className="px-3 py-2 font-medium">{ts('fields.startDate')}</th>
              <th className="px-3 py-2 font-medium">{ts('endDate')}</th>
            </tr>
          </thead>
          <tbody>
            {rentals.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">
                  {r.container_id ? (
                    <Link
                      href={`/dashboard/storage/${r.site_id}/${r.container_id}`}
                      className="font-mono hover:underline"
                    >
                      {r.container_code}
                    </Link>
                  ) : (
                    <span className="font-mono">{r.container_code}</span>
                  )}
                </td>
                <td className="px-3 py-2">{r.site_name}</td>
                <td className="px-3 py-2">
                  {isRentalStatus(r.status) ? ts(`rentalStates.${r.status}`) : '—'}
                </td>
                <td className="px-3 py-2">{formatPence(r.monthly_rate_pence)}</td>
                <td className="px-3 py-2">{formatDate(r.start_date)}</td>
                <td className="px-3 py-2">{r.end_date ? formatDate(r.end_date) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
