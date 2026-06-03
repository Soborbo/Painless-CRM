'use server';

import { requireRole } from '@/lib/auth/require-role';
import { StorageIdSchema } from '@/lib/schemas/storage';
import { buildContainerImport } from '@/lib/storage/csv-import';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

type DbClient = Awaited<ReturnType<typeof createClient>>;

// Phase 24 — storage container CSV import (ADR-033). Validate-then-commit with a
// preview step; no silent row drops.

const ROLES = ['manager', 'admin', 'super_admin'] as const;

export type ImportState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'preview'; valid: number; duplicates: string[]; errors: { line: number; message: string }[] }
  | { status: 'done'; inserted: number; skipped: number };

export const INITIAL_IMPORT_STATE: ImportState = { status: 'idle' };

async function existingCodes(supabase: DbClient, siteId: string): Promise<string[]> {
  const { data } = await supabase
    .from('storage_containers')
    .select('container_code')
    .eq('storage_site_id', siteId)
    .is('deleted_at', null);
  return ((data ?? []) as Array<{ container_code: string }>).map((r) => r.container_code);
}

export async function importContainers(_prev: ImportState, form: FormData): Promise<ImportState> {
  const me = await requireRole(ROLES);
  const siteId = StorageIdSchema.safeParse(form.get('site_id'));
  if (!siteId.success) return { status: 'error', message: 'Missing site' };

  const text = String(form.get('csv') ?? '');
  if (!text.trim()) return { status: 'error', message: 'Paste some CSV first' };

  const commit = form.get('mode') === 'commit';
  const supabase = await createClient();
  const result = buildContainerImport(text, await existingCodes(supabase, siteId.data));

  if (!commit) {
    return {
      status: 'preview',
      valid: result.valid.length,
      duplicates: result.duplicateCodes,
      errors: result.errors,
    };
  }

  if (result.valid.length === 0) {
    return { status: 'error', message: 'Nothing valid to import — fix the rows and preview again' };
  }
  const { error } = await supabase.from('storage_containers').insert(
    result.valid.map((c) => ({
      ...c,
      company_id: me.company_id,
      storage_site_id: siteId.data,
    })),
  );
  if (error) {
    const message =
      error.code === '23505'
        ? 'Some codes already exist — preview again to see the duplicates'
        : 'Import failed';
    return { status: 'error', message };
  }

  revalidatePath(`/dashboard/storage/${siteId.data}`);
  return {
    status: 'done',
    inserted: result.valid.length,
    skipped: result.duplicateCodes.length + result.errors.length,
  };
}
