'use server';

import { requireRole } from '@/lib/auth/require-role';
import { MergeCustomersSchema } from '@/lib/schemas/customer';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const MERGE_ROLES = ['manager', 'admin', 'super_admin'] as const;

export type MergeActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; merged: number };

// Folds the selected duplicates into the kept record. Each loser is merged by
// its own atomic merge_customers RPC call; the loser's current version is read
// first and passed for the optimistic-concurrency guard inside the function.
export async function mergeCustomers(
  _prev: MergeActionState,
  form: FormData,
): Promise<MergeActionState> {
  const me = await requireRole(MERGE_ROLES);

  const winnerId = form.get('winner_id');
  const memberIds = form.getAll('member_id').map((v) => String(v));
  const loserIds = memberIds.filter((id) => id && id !== winnerId);

  const parsed = MergeCustomersSchema.safeParse({ winner_id: winnerId, loser_ids: loserIds });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid selection' };
  }

  const supabase = await createClient();

  // Current versions of the losers, for the optimistic guard. RLS scopes this
  // to the tenant; a row missing here was already merged or deleted.
  const { data: losers, error: readError } = await supabase
    .from('customers')
    .select('id, version')
    .in('id', parsed.data.loser_ids)
    .is('deleted_at', null);
  if (readError) return { status: 'error', message: 'Could not load the duplicates' };

  const versionById = new Map(
    ((losers ?? []) as Array<{ id: string; version: number }>).map((l) => [l.id, l.version]),
  );

  let merged = 0;
  for (const loserId of parsed.data.loser_ids) {
    const version = versionById.get(loserId);
    if (version === undefined) continue; // already gone — treat as done
    const { error } = await supabase.rpc('merge_customers', {
      p_company_id: me.company_id,
      p_winner_id: parsed.data.winner_id,
      p_loser_id: loserId,
      p_loser_version: version,
    });
    if (error) {
      return {
        status: 'error',
        message:
          merged > 0
            ? `Merged ${merged}, then hit a conflict — reload and retry the rest.`
            : 'Could not merge — reload and try again.',
      };
    }
    merged += 1;
  }

  revalidatePath('/dashboard/customers/duplicates');
  revalidatePath('/dashboard/customers');
  revalidatePath(`/dashboard/customers/${parsed.data.winner_id}`);
  return { status: 'ok', merged };
}
