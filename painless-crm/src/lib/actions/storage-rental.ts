'use server';

import type { StorageActionState } from '@/lib/actions/storage';
import { requireRole } from '@/lib/auth/require-role';
import { StorageIdSchema, StorageVersionSchema } from '@/lib/schemas/storage';
import {
  CreateRentalSchema,
  RentalIdSchema,
  RentalVersionSchema,
} from '@/lib/schemas/storage-rental';
import { fetchContainer, setContainerStatus } from '@/lib/storage/container-sync';
import type { ContainerStatus } from '@/lib/storage/occupancy';
import {
  canReserveContainer,
  containerStatusForRental,
  isRentalStatus,
  isRentalTransitionAllowed,
} from '@/lib/storage/rental-lifecycle';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const STORAGE_ROLES = ['manager', 'admin', 'super_admin'] as const;

function pathFor(siteId: string, containerId: string) {
  return `/dashboard/storage/${siteId}/${containerId}`;
}

// Monthly rate is entered in pounds; the column stores integer pence.
function penceFromPounds(value: FormDataEntryValue | null): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === '') return '';
  const pounds = Number(raw);
  if (!Number.isFinite(pounds)) return raw;
  return String(Math.round(pounds * 100));
}

export async function createRental(
  _prev: StorageActionState,
  form: FormData,
): Promise<StorageActionState> {
  const me = await requireRole(STORAGE_ROLES);
  const containerId = StorageIdSchema.safeParse(form.get('container_id'));
  if (!containerId.success) return { status: 'error', message: 'Missing container' };

  const parsed = CreateRentalSchema.safeParse({
    customer_id: form.get('customer_id'),
    start_date: form.get('start_date'),
    monthly_rate_pence: penceFromPounds(form.get('monthly_rate_pounds')),
    mode: form.get('mode'),
    notes: form.get('notes'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const container = await fetchContainer(supabase, containerId.data);
  if (!container) return { status: 'error', message: 'Container not found' };
  const currentStatus = (container.status ?? 'available') as ContainerStatus;
  if (!canReserveContainer(currentStatus)) {
    return { status: 'error', message: 'This container is not available to rent' };
  }

  const rentalStatus = parsed.data.mode === 'activate' ? 'active' : 'pending';
  const { error } = await supabase.from('storage_rentals').insert({
    company_id: me.company_id,
    customer_id: parsed.data.customer_id,
    storage_container_id: containerId.data,
    start_date: parsed.data.start_date,
    monthly_rate_pence: parsed.data.monthly_rate_pence,
    status: rentalStatus,
    notes: parsed.data.notes ?? null,
  });
  if (error) return { status: 'error', message: 'Could not open the rental' };

  const synced = await setContainerStatus(
    supabase,
    container.id,
    containerStatusForRental(rentalStatus),
    container.version,
  );
  if (!synced) {
    return { status: 'error', message: 'The container changed while saving. Reload and retry.' };
  }

  revalidatePath(pathFor(container.storage_site_id, container.id));
  redirect(pathFor(container.storage_site_id, container.id));
}

// Shared body for the two rental transitions (activate / terminate).
async function transitionRental(
  form: FormData,
  to: 'active' | 'terminated',
): Promise<StorageActionState> {
  await requireRole(STORAGE_ROLES);
  const rentalId = RentalIdSchema.safeParse(form.get('rental_id'));
  const containerId = StorageIdSchema.safeParse(form.get('container_id'));
  const rentalVersion = RentalVersionSchema.safeParse(form.get('rental_version'));
  const containerVersion = StorageVersionSchema.safeParse(form.get('container_version'));
  if (
    !rentalId.success ||
    !containerId.success ||
    !rentalVersion.success ||
    !containerVersion.success
  ) {
    return { status: 'error', message: 'Missing id or version' };
  }

  const supabase = await createClient();
  const { data: rentalRow } = await supabase
    .from('storage_rentals')
    .select('status, storage_container_id')
    .eq('id', rentalId.data)
    .is('deleted_at', null)
    .maybeSingle();
  const from = (rentalRow as { status: string | null } | null)?.status;
  if (!isRentalStatus(from) || !isRentalTransitionAllowed(from, to)) {
    return { status: 'error', message: 'That rental can no longer change to this state' };
  }

  const update: Record<string, unknown> = {
    status: to,
    version: rentalVersion.data + 1,
    updated_at: new Date().toISOString(),
  };
  if (to === 'terminated') update.end_date = new Date().toISOString().slice(0, 10);

  const { data: updated } = await supabase
    .from('storage_rentals')
    .update(update)
    .eq('id', rentalId.data)
    .eq('version', rentalVersion.data)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (!updated) {
    return { status: 'error', message: 'This rental was changed elsewhere. Reload and retry.' };
  }

  const synced = await setContainerStatus(
    supabase,
    containerId.data,
    containerStatusForRental(to),
    containerVersion.data,
  );
  if (!synced) {
    return { status: 'error', message: 'The container changed while saving. Reload and retry.' };
  }

  const siteContainerPath = pathFor(form.get('site_id')?.toString() ?? '', containerId.data);
  revalidatePath(siteContainerPath);
  redirect(siteContainerPath);
}

export async function activateRental(
  _prev: StorageActionState,
  form: FormData,
): Promise<StorageActionState> {
  return transitionRental(form, 'active');
}

export async function terminateRental(
  _prev: StorageActionState,
  form: FormData,
): Promise<StorageActionState> {
  return transitionRental(form, 'terminated');
}
