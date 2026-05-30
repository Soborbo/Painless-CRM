'use server';

import { requireRole } from '@/lib/auth/require-role';
import { DOWNLOAD_URL_TTL_SECONDS, STORAGE_BUCKET } from '@/lib/documents/constants';
import { buildStoragePath, validateUpload } from '@/lib/documents/storage-path';
import {
  DownloadDocumentSchema,
  SoftDeleteDocumentSchema,
  UploadDocumentSchema,
} from '@/lib/schemas/document';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const DOC_ROLES = ['sales', 'manager', 'admin', 'super_admin', 'surveyor', 'accounts'] as const;

export type DocumentActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ok'; document_id: string };

export const INITIAL_DOCUMENT_ACTION_STATE: DocumentActionState = { status: 'idle' };

function parentColumn(parentType: 'customer' | 'job'): 'parent_customer_id' | 'parent_job_id' {
  return parentType === 'customer' ? 'parent_customer_id' : 'parent_job_id';
}

function detailPath(parentType: 'customer' | 'job', parentId: string): string {
  return parentType === 'customer'
    ? `/dashboard/customers/${parentId}`
    : `/dashboard/jobs/${parentId}`;
}

export async function uploadDocument(
  _prev: DocumentActionState,
  form: FormData,
): Promise<DocumentActionState> {
  const me = await requireRole(DOC_ROLES);

  const parsed = UploadDocumentSchema.safeParse({
    parent_type: form.get('parent_type'),
    parent_id: form.get('parent_id'),
    document_type: form.get('document_type'),
    is_customer_visible: form.get('is_customer_visible'),
    notes: form.get('notes'),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const file = form.get('file');
  if (!(file instanceof File)) return { status: 'error', message: 'No file provided' };

  const check = validateUpload({ size: file.size, mimeType: file.type });
  if (!check.ok) {
    const message =
      check.reason === 'too_large'
        ? 'File is too large (max 25 MB)'
        : check.reason === 'mime'
          ? 'That file type is not allowed'
          : 'File is empty';
    return { status: 'error', message };
  }

  const { parent_type, parent_id, document_type, is_customer_visible, notes } = parsed.data;
  const supabase = await createClient();

  // Confirm the parent exists in this tenant (RLS scopes the lookup) before we
  // spend a Storage round-trip.
  const { data: parent } = await supabase
    .from(parent_type === 'customer' ? 'customers' : 'jobs')
    .select('id')
    .eq('id', parent_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!parent) return { status: 'error', message: 'Parent record not found' };

  const documentId = crypto.randomUUID();
  const storagePath = buildStoragePath(me.company_id, documentId, file.name);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) return { status: 'error', message: 'Upload failed, please try again' };

  const { error: insertError } = await supabase.from('documents').insert({
    id: documentId,
    company_id: me.company_id,
    [parentColumn(parent_type)]: parent_id,
    document_type,
    file_name: file.name.slice(0, 255),
    storage_path: storagePath,
    file_size_bytes: file.size,
    mime_type: file.type,
    uploaded_by_id: me.id,
    uploaded_by_customer: false,
    is_customer_visible,
    notes,
  });
  if (insertError) {
    // Roll the orphaned object back so a failed insert leaves no dangling bytes.
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return { status: 'error', message: 'Could not save document' };
  }

  revalidatePath(detailPath(parent_type, parent_id));
  return { status: 'ok', document_id: documentId };
}

export async function softDeleteDocument(
  _prev: DocumentActionState,
  form: FormData,
): Promise<DocumentActionState> {
  await requireRole(DOC_ROLES);

  const parsed = SoftDeleteDocumentSchema.safeParse({
    id: form.get('id'),
    parent_type: form.get('parent_type'),
    parent_id: form.get('parent_id'),
  });
  if (!parsed.success) return { status: 'error', message: 'Invalid input' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq(parentColumn(parsed.data.parent_type), parsed.data.parent_id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', message: 'Could not delete document' };
  if (!data) return { status: 'error', message: 'Document not found' };

  revalidatePath(detailPath(parsed.data.parent_type, parsed.data.parent_id));
  return { status: 'ok', document_id: parsed.data.id };
}

export type DownloadUrlResult =
  | { ok: true; url: string; file_name: string }
  | { ok: false; message: string };

// Mints a short-lived signed URL for an office user to download a vault file.
// RLS + the storage policy both gate this to the user's own tenant.
export async function getDocumentDownloadUrl(documentId: string): Promise<DownloadUrlResult> {
  await requireRole(DOC_ROLES);

  const parsed = DownloadDocumentSchema.safeParse({ id: documentId });
  if (!parsed.success) return { ok: false, message: 'Invalid request' };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path, file_name')
    .eq('id', parsed.data.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!doc) return { ok: false, message: 'Document not found' };

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(doc.storage_path as string, DOWNLOAD_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return { ok: false, message: 'Could not prepare download' };

  return { ok: true, url: data.signedUrl, file_name: doc.file_name as string };
}
