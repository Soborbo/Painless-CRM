import { createClient } from '@/lib/supabase/server';

export interface NoteRow {
  id: string;
  body: string;
  is_customer_visible: boolean;
  pinned: boolean;
  created_at: string;
  edited_at: string | null;
  created_by: { id: string; full_name: string } | null;
}

const COLUMNS = `
  id, body, is_customer_visible, pinned, created_at, edited_at,
  created_by:users!notes_created_by_id_fkey (id, full_name)
`;

function flatten(raw: Record<string, unknown>): NoteRow {
  const userRaw = raw.created_by as unknown;
  const createdBy = Array.isArray(userRaw)
    ? ((userRaw[0] as { id: string; full_name: string } | undefined) ?? null)
    : ((userRaw as { id: string; full_name: string } | null) ?? null);
  return {
    id: raw.id as string,
    body: raw.body as string,
    is_customer_visible: Boolean(raw.is_customer_visible),
    pinned: Boolean(raw.pinned),
    created_at: raw.created_at as string,
    edited_at: (raw.edited_at as string | null) ?? null,
    created_by: createdBy,
  };
}

export async function listNotesForJob(jobId: string): Promise<NoteRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('notes')
    .select(COLUMNS)
    .eq('parent_type', 'job')
    .eq('parent_id', jobId)
    .is('deleted_at', null)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);
  return ((data ?? []) as Array<Record<string, unknown>>).map(flatten);
}
