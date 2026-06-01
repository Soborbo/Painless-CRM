import { requireRole } from '@/lib/auth/require-role';
import { getTeamStats } from '@/lib/queries/team-stats';
import Link from 'next/link';

const MANAGER_ROLES = ['manager', 'admin', 'super_admin'] as const;

export default async function TeamReportPage() {
  await requireRole(MANAGER_ROLES);
  const stats = await getTeamStats();

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link href="/dashboard/reports" className="hover:underline">
          ← Reports
        </Link>
      </p>
      <h1 className="mt-1 text-xl font-semibold">Per-worker performance</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        Keyed to the worker who captured each job’s customer sign-off. Internal use only — never
        shown to customers and never used to filter who gets a review request.
      </p>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          <tr>
            <th className="py-2">Worker</th>
            <th className="py-2">Jobs</th>
            <th className="py-2">Reviews</th>
            <th className="py-2">Complaints</th>
            <th className="py-2">Damages</th>
            <th className="py-2">Avg rating</th>
          </tr>
        </thead>
        <tbody>
          {stats.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-4 text-[var(--color-muted-foreground)]">
                No sign-offs recorded yet.
              </td>
            </tr>
          ) : (
            stats.map((s) => (
              <tr key={s.worker_id} className="border-b">
                <td className="py-2">{s.worker_name}</td>
                <td className="py-2">{s.jobs}</td>
                <td className="py-2">{s.reviews}</td>
                <td className="py-2">{s.complaints}</td>
                <td className="py-2">{s.damages}</td>
                <td className="py-2">{s.avg_rating ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </main>
  );
}
