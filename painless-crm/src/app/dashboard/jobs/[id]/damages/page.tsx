import { requireRole } from '@/lib/auth/require-role';
import { getDamagesForJob } from '@/lib/queries/damages';
import { formatPence } from '@/lib/utils/format';
import Link from 'next/link';
import { DamageEdit } from './damage-edit';
import { DamageNewForm } from './damage-new-form';

const MANAGER_ROLES = ['manager', 'admin', 'super_admin'] as const;

type Props = { params: Promise<{ id: string }> };

export default async function JobDamagesPage({ params }: Props) {
  const me = await requireRole(MANAGER_ROLES);
  const isAdmin = me.role === 'admin' || me.role === 'super_admin';
  const { id } = await params;
  const damages = await getDamagesForJob(id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link href={`/dashboard/jobs/${id}`} className="hover:underline">
          ← Back to job
        </Link>
      </p>
      <h1 className="mt-1 text-xl font-semibold">Damage claims</h1>

      {isAdmin ? (
        <div className="mt-4">
          <DamageNewForm jobId={id} />
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {damages.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No damage claims for this job.
          </p>
        ) : (
          damages.map((d) => (
            <div key={d.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium capitalize">{d.status}</span>
                {d.repeat_claim_flag ? (
                  <span className="rounded bg-[var(--color-warning,#d97706)]/15 px-2 py-0.5 text-xs text-[var(--color-warning,#d97706)]">
                    Repeat claimant
                  </span>
                ) : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap">{d.description}</p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                Estimated {formatPence(d.estimated_value_pence)} · Payout{' '}
                {formatPence(d.payout_pence)}
                {d.insurance_claim_ref ? ` · Insurer ${d.insurance_claim_ref}` : ''}
                {d.reported_by_customer ? ' · Customer-reported' : ''}
              </p>
              {isAdmin ? (
                <DamageEdit
                  id={d.id}
                  version={d.version}
                  status={d.status}
                  estimatedPence={d.estimated_value_pence}
                  payoutPence={d.payout_pence}
                  insuranceRef={d.insurance_claim_ref}
                />
              ) : null}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
