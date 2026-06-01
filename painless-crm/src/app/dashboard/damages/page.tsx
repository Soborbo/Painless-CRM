import { requireRole } from '@/lib/auth/require-role';
import { listDamages } from '@/lib/queries/damages';
import { formatDate, formatPence } from '@/lib/utils/format';
import Link from 'next/link';

const MANAGER_ROLES = ['manager', 'admin', 'super_admin'] as const;

export default async function DamagesPage() {
  await requireRole(MANAGER_ROLES);
  const damages = await listDamages();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold">Damage claims</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        Claims are managed per job. Admins can edit; managers have read access.
      </p>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          <tr>
            <th className="py-2">Job</th>
            <th className="py-2">Customer</th>
            <th className="py-2">Status</th>
            <th className="py-2">Estimated</th>
            <th className="py-2">Payout</th>
            <th className="py-2">Reported</th>
          </tr>
        </thead>
        <tbody>
          {damages.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-4 text-[var(--color-muted-foreground)]">
                No damage claims.
              </td>
            </tr>
          ) : (
            damages.map((d) => (
              <tr key={d.id} className="border-b">
                <td className="py-2">
                  <Link href={`/dashboard/jobs/${d.job_id}/damages`} className="hover:underline">
                    {d.job_number ?? '—'}
                  </Link>
                </td>
                <td className="py-2">
                  {d.customer_name}
                  {d.repeat_claim_flag ? (
                    <span className="ml-2 rounded bg-[var(--color-warning,#d97706)]/15 px-1.5 py-0.5 text-xs text-[var(--color-warning,#d97706)]">
                      repeat
                    </span>
                  ) : null}
                </td>
                <td className="py-2 capitalize">{d.status}</td>
                <td className="py-2">{formatPence(d.estimated_value_pence)}</td>
                <td className="py-2">{formatPence(d.payout_pence)}</td>
                <td className="py-2">{formatDate(d.created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </main>
  );
}
