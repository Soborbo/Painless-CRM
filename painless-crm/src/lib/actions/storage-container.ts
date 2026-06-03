'use server';

import type { StorageActionState } from '@/lib/actions/storage';
import { requireRole } from '@/lib/auth/require-role';
import {
  StorageContainerSchema,
  StorageIdSchema,
  StorageVersionSchema,
} from '@/lib/schemas/storage';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const STORAGE_ROLES = ['manager', 'admin', 'super_admin'] as const;

// Monthly rate is entered in pounds; the column stores integer pence.
function penceFromPounds(value: FormDataEntryValue | null): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === '') return '';
  const pounds = Number(raw);
  if (!Number.isFinite(pounds)) return raw;
  return String(Math.round(pounds * 100));
}

function readContainer(form: FormData) {
  return {
    container_code: form.get('container_code'),
    size_cubic_ft: form.get('size_cubic_ft') ?? '',
    monthly_rate_pence: penceFromPounds(form.get('monthly_rate_pounds')),
    status: form.get('status'),
    notes: form.get('notes'),
  };
}

export async function createStorageContainer(
  _prev: StorageActionState,
  form: FormData,
): Promise<StorageActionState> {
  const me = await requireRole(STORAGE_ROLES);
  const siteId = StorageIdSchema.safeParse(form.get('site_id'));
  if (!siteId.success) return { status: 'error', message: 'Missing site' };

  const parsed = StorageContainerSchema.safeParse(readContainer(form));
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('storage_containers').insert({
    ...parsed.data,
    size_cubic_ft: parsed.data.size_cubic_ft ?? null,
    notes: parsed.data.notes ?? null,
    company_id: me.company_id,
    storage_site_id: siteId.data,
  });
  if (error) {
    const message =
      error.code === '23505'
        ? 'A container with that code already exists at this site'
        : 'Could not add the container';
    return { status: 'error', message };
  }

  revalidatePath(`/dashboard/storage/${siteId.data}`);
  redirect(`/dashboard/storage/${siteId.data}`);
}

export async function updateStorageContainer(
  _prev: StorageActionState,
  form: FormData,
): Promise<StorageActionState> {
  await requireRole(STORAGE_ROLES);
  const idResult = StorageIdSchema.safeParse(form.get('id'));
  const siteId = StorageIdSchema.safeParse(form.get('site_id'));
  const versionResult = StorageVersionSchema.safeParse(form.get('version'));
  if (!idResult.success || !siteId.success || !versionResult.success) {
    return { status: 'error', message: 'Missing id or version' };
  }

  const parsed = StorageContainerSchema.safeParse(readContainer(form));
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('storage_containers')
    .update({
      ...parsed.data,
      size_cubic_ft: parsed.data.size_cubic_ft ?? null,
      notes: parsed.data.notes ?? null,
      version: versionResult.data + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', idResult.data)
    .eq('version', versionResult.data)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    const message =
      error.code === '23505'
        ? 'A container with that code already exists at this site'
        : 'Could not update the container';
    return { status: 'error', message };
  }
  if (!data) {
    return {
      status: 'error',
      message: 'This container was edited elsewhere. Reload to see the latest.',
    };
  }

  revalidatePath(`/dashboard/storage/${siteId.data}`);
  redirect(`/dashboard/storage/${siteId.data}/${idResult.data}`);
}

// Phase 24 — clone a container as a fresh, available unit (code suffixed
// "-COPY"). A quick way to provision a row of identical containers.
export async function duplicateStorageContainer(
  _prev: StorageActionState,
  form: FormData,
): Promise<StorageActionState> {
  const me = await requireRole(STORAGE_ROLES);
  const idResult = StorageIdSchema.safeParse(form.get('id'));
  const siteId = StorageIdSchema.safeParse(form.get('site_id'));
  if (!idResult.success || !siteId.success) return { status: 'error', message: 'Missing id' };

  const supabase = await createClient();
  const { data: src } = await supabase
    .from('storage_containers')
    .select('container_code, size_cubic_ft, monthly_rate_pence, notes')
    .eq('id', idResult.data)
    .is('deleted_at', null)
    .maybeSingle();
  if (!src) return { status: 'error', message: 'Container not found' };
  const s = src as {
    container_code: string;
    size_cubic_ft: number | null;
    monthly_rate_pence: number;
    notes: string | null;
  };

  const { error } = await supabase.from('storage_containers').insert({
    company_id: me.company_id,
    storage_site_id: siteId.data,
    container_code: `${s.container_code}-COPY`,
    size_cubic_ft: s.size_cubic_ft,
    monthly_rate_pence: s.monthly_rate_pence,
    status: 'available',
    notes: s.notes,
  });
  if (error) {
    const message =
      error.code === '23505'
        ? 'A "-COPY" of this container already exists — rename it first'
        : 'Could not duplicate the container';
    return { status: 'error', message };
  }

  revalidatePath(`/dashboard/storage/${siteId.data}`);
  redirect(`/dashboard/storage/${siteId.data}`);
}

export async function softDeleteStorageContainer(
  _prev: StorageActionState,
  form: FormData,
): Promise<StorageActionState> {
  await requireRole(['admin', 'super_admin']);
  const idResult = StorageIdSchema.safeParse(form.get('id'));
  const siteId = StorageIdSchema.safeParse(form.get('site_id'));
  const versionResult = StorageVersionSchema.safeParse(form.get('version'));
  if (!idResult.success || !siteId.success || !versionResult.success) {
    return { status: 'error', message: 'Missing id or version' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('storage_containers')
    .update({ deleted_at: new Date().toISOString(), version: versionResult.data + 1 })
    .eq('id', idResult.data)
    .eq('version', versionResult.data)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error || !data) return { status: 'error', message: 'Could not delete the container' };

  revalidatePath(`/dashboard/storage/${siteId.data}`);
  redirect(`/dashboard/storage/${siteId.data}`);
}
