'use server';

import { requireRole } from '@/lib/auth/require-role';
import { StorageSiteSchema } from '@/lib/schemas/storage';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Storage sites are operational records — managers and admins. Container
// actions live in ./storage-container.ts (kept separate for file size).
const STORAGE_ROLES = ['manager', 'admin', 'super_admin'] as const;

export type StorageActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; id: string };

const IDLE: StorageActionState = { status: 'idle' };

// Resolve an address row for a site, reusing an existing one if the company
// already has a matching address (the addresses dedup index would reject a
// duplicate insert). Returns the address id.
async function upsertAddress(
  supabase: ServerClient,
  companyId: string,
  addr: { line1: string; line2?: string; city: string; postcode: string },
): Promise<string | null> {
  const { data, error } = await supabase
    .from('addresses')
    .insert({ ...addr, company_id: companyId })
    .select('id')
    .single();
  if (data) return data.id;
  if (error?.code !== '23505') return null;

  // Duplicate: find the existing live row by its natural key.
  const { data: existing } = await supabase
    .from('addresses')
    .select('id')
    .eq('line1', addr.line1)
    .eq('postcode', addr.postcode)
    .is('deleted_at', null)
    .maybeSingle();
  return existing?.id ?? null;
}

export async function createStorageSite(
  _prev: StorageActionState,
  form: FormData,
): Promise<StorageActionState> {
  const me = await requireRole(STORAGE_ROLES);

  const parsed = StorageSiteSchema.safeParse({
    name: form.get('name'),
    line1: form.get('line1'),
    line2: form.get('line2'),
    city: form.get('city'),
    postcode: form.get('postcode'),
    total_containers: form.get('total_containers') ?? '',
    notes: form.get('notes'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const addressId = await upsertAddress(supabase, me.company_id, {
    line1: parsed.data.line1,
    line2: parsed.data.line2,
    city: parsed.data.city,
    postcode: parsed.data.postcode,
  });
  if (!addressId) return { status: 'error', message: 'Could not save the site address' };

  const { data, error } = await supabase
    .from('storage_sites')
    .insert({
      company_id: me.company_id,
      name: parsed.data.name,
      address_id: addressId,
      total_containers: parsed.data.total_containers ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select('id')
    .single();
  if (error || !data) return { status: 'error', message: 'Could not create the site' };

  revalidatePath('/dashboard/storage');
  redirect(`/dashboard/storage/${data.id}`);
}

export { IDLE as INITIAL_STORAGE_STATE };
