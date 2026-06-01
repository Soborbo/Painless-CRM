import { requireRole } from '@/lib/auth/require-role';
import { getComplaintsForJob } from '@/lib/queries/complaints';
import Link from 'next/link';
import { ComplaintCard } from '../../../complaints/complaint-card';

const MANAGER_ROLES = ['manager', 'admin', 'super_admin'] as const;

type Props = { params: Promise<{ id: string }> };

export default async function JobComplaintsPage({ params }: Props) {
  await requireRole(MANAGER_ROLES);
  const { id } = await params;
  const complaints = await getComplaintsForJob(id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link href={`/dashboard/jobs/${id}`} className="hover:underline">
          ← Back to job
        </Link>
      </p>
      <h1 className="mt-1 text-xl font-semibold">Complaints</h1>

      <div className="mt-6 flex flex-col gap-3">
        {complaints.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No complaints recorded for this job.
          </p>
        ) : (
          complaints.map((c) => <ComplaintCard key={c.id} complaint={c} />)
        )}
      </div>
    </main>
  );
}
