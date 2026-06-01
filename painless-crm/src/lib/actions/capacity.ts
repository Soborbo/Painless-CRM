'use server';

import type { CapacityOverrideState } from '@/lib/actions/capacity-state';
import { requireRole } from '@/lib/auth/require-role';
import { publishAvailability } from '@/lib/capacity/publish';
import { ClearCapacityOverrideSchema, SetCapacityOverrideSchema } from '@/lib/schemas/capacity';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Re-broadcast the availability calendar after an override change. Best-effort:
// a KV/read failure must not fail the override the admin just made.
async function rebroadcast(companyId: string): Promise<void> {
  try {
    await publishAvailability(companyId);
  } catch {
    // swallow — broadcasting is best-effort
  }
}

// Admin capacity overrides. The capacity_overrides_audit trigger records every
// change to activity_log (migration 37), so no manual audit here. RLS scopes
// the write to the caller's company; the role gate keeps it admin-only.

const OVERRIDE_ROLES = ['admin', 'super_admin'] as const;

export async function setCapacityOverride(
  _prev: CapacityOverrideState,
  form: FormData,
): Promise<CapacityOverrideState> {
  const me = await requireRole(OVERRIDE_ROLES);

  const parsed = SetCapacityOverrideSchema.safeParse({
    date: form.get('date'),
    forced_band: form.get('forced_band'),
    reason: form.get('reason'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('capacity_overrides').upsert(
    {
      company_id: me.company_id,
      date: parsed.data.date,
      forced_band: parsed.data.forced_band,
      reason: parsed.data.reason,
      applied_by_id: me.id,
      applied_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,date' },
  );
  if (error) return { status: 'error', message: 'Could not save the override' };

  await rebroadcast(me.company_id);
  revalidatePath('/dashboard/capacity');
  return { status: 'ok' };
}

export async function clearCapacityOverride(
  _prev: CapacityOverrideState,
  form: FormData,
): Promise<CapacityOverrideState> {
  const me = await requireRole(OVERRIDE_ROLES);

  const parsed = ClearCapacityOverrideSchema.safeParse({ date: form.get('date') });
  if (!parsed.success) return { status: 'error', message: 'Invalid date' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('capacity_overrides')
    .delete()
    .eq('company_id', me.company_id)
    .eq('date', parsed.data.date);
  if (error) return { status: 'error', message: 'Could not clear the override' };

  await rebroadcast(me.company_id);
  revalidatePath('/dashboard/capacity');
  return { status: 'ok' };
}
