import { requireRole } from '@/lib/auth/require-role';
import { type ComplaintRow, listComplaints } from '@/lib/queries/complaints';
import { ComplaintCard } from './complaint-card';

const MANAGER_ROLES = ['manager', 'admin', 'super_admin'] as const;

const COLUMNS: { status: ComplaintRow['status']; label: string }[] = [
  { status: 'new', label: 'New' },
  { status: 'investigating', label: 'Investigating' },
  { status: 'escalated', label: 'Escalated' },
  { status: 'resolved', label: 'Resolved' },
];

export default async function ComplaintsPage() {
  await requireRole(MANAGER_ROLES);
  const complaints = await listComplaints();
  const byStatus = (status: ComplaintRow['status']) =>
    complaints.filter((c) => c.status === status);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-xl font-semibold">Complaints</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        Every paid customer receives a review request with a complaints link. Complaints land here
        with a 24-hour first-response SLA.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = byStatus(col.status);
          return (
            <section key={col.status} className="flex flex-col gap-3">
              <h2 className="text-sm font-medium">
                {col.label}{' '}
                <span className="text-[var(--color-muted-foreground)]">({items.length})</span>
              </h2>
              {items.length === 0 ? (
                <p className="text-xs text-[var(--color-muted-foreground)]">None</p>
              ) : (
                items.map((c) => <ComplaintCard key={c.id} complaint={c} />)
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
