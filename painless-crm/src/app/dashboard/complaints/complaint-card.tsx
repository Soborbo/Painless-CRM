'use client';

import { type ComplaintActionState, updateComplaint } from '@/lib/actions/complaints';
import type { ComplaintRow } from '@/lib/queries/complaints';
import Link from 'next/link';
import { useActionState } from 'react';

const INITIAL: ComplaintActionState = { status: 'idle' };
const NEXT: Record<ComplaintRow['status'], ComplaintRow['status'][]> = {
  new: ['investigating', 'resolved', 'escalated'],
  investigating: ['resolved', 'escalated'],
  escalated: ['investigating', 'resolved'],
  resolved: [],
};

export function ComplaintCard({ complaint }: { complaint: ComplaintRow }) {
  const [state, action, pending] = useActionState(updateComplaint, INITIAL);
  const options = NEXT[complaint.status];
  const overdue =
    !complaint.sla_first_response_at &&
    complaint.sla_first_response_due_at != null &&
    Date.parse(complaint.sla_first_response_due_at) < Date.now();

  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/dashboard/jobs/${complaint.job_id}/complaints`}
          className="font-medium hover:underline"
        >
          {complaint.job_number ?? '—'}
        </Link>
        {overdue ? (
          <span className="rounded bg-[var(--color-danger,#dc2626)]/15 px-2 py-0.5 text-xs text-[var(--color-danger,#dc2626)]">
            SLA overdue
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{complaint.customer_name}</p>
      <p className="mt-2 whitespace-pre-wrap">{complaint.description}</p>
      {complaint.severity_self_assessed ? (
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Customer: {complaint.severity_self_assessed}
        </p>
      ) : null}

      {options.length > 0 ? (
        <form action={action} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="id" value={complaint.id} />
          <input type="hidden" name="version" value={complaint.version} />
          <select
            name="status"
            defaultValue={complaint.status}
            className="rounded-md border bg-transparent px-2 py-1"
          >
            <option value={complaint.status} disabled>
              {complaint.status}
            </option>
            {options.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <textarea
            name="resolution_notes"
            placeholder="Resolution notes"
            rows={2}
            defaultValue={complaint.resolution_notes ?? ''}
            className="rounded-md border px-2 py-1"
          />
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Update'}
          </button>
          {state.status === 'error' ? (
            <p className="text-xs text-[var(--color-danger,#dc2626)]">{state.message}</p>
          ) : null}
        </form>
      ) : (
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Resolved</p>
      )}
    </div>
  );
}
