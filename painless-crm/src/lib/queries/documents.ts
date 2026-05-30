import {
  type DocumentType,
  PUBLIC_DOWNLOAD_URL_TTL_SECONDS,
  STORAGE_BUCKET,
} from '@/lib/documents/constants';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// Document vault reads — Phase 06b §7. Office reads go through the RLS-scoped
// authed client; the public quote-acceptance page reads customer-visible rows
// through the admin client (the customer is not signed in).

export interface DocumentRow {
  id: string;
  document_type: DocumentType;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  is_customer_visible: boolean;
  notes: string | null;
  uploaded_at: string;
  uploaded_by_customer: boolean;
  uploaded_by: { id: string; full_name: string } | null;
}

const COLUMNS = `
  id, document_type, file_name, file_size_bytes, mime_type,
  is_customer_visible, notes, uploaded_at, uploaded_by_customer,
  uploaded_by:users!documents_uploaded_by_id_fkey (id, full_name)
`;

function flatten(raw: Record<string, unknown>): DocumentRow {
  const userRaw = raw.uploaded_by as unknown;
  const uploadedBy = Array.isArray(userRaw)
    ? ((userRaw[0] as { id: string; full_name: string } | undefined) ?? null)
    : ((userRaw as { id: string; full_name: string } | null) ?? null);
  return {
    id: raw.id as string,
    document_type: raw.document_type as DocumentType,
    file_name: raw.file_name as string,
    file_size_bytes: Number(raw.file_size_bytes ?? 0),
    mime_type: raw.mime_type as string,
    is_customer_visible: Boolean(raw.is_customer_visible),
    notes: (raw.notes as string | null) ?? null,
    uploaded_at: raw.uploaded_at as string,
    uploaded_by_customer: Boolean(raw.uploaded_by_customer),
    uploaded_by: uploadedBy,
  };
}

export async function listDocumentsForJob(jobId: string): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('documents')
    .select(COLUMNS)
    .eq('parent_job_id', jobId)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false })
    .limit(200);
  return ((data ?? []) as Array<Record<string, unknown>>).map(flatten);
}

export async function listDocumentsForCustomer(customerId: string): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('documents')
    .select(COLUMNS)
    .eq('parent_customer_id', customerId)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false })
    .limit(200);
  return ((data ?? []) as Array<Record<string, unknown>>).map(flatten);
}

export interface PublicDocument {
  id: string;
  document_type: DocumentType;
  file_name: string;
  file_size_bytes: number;
  storage_path: string;
}

// Customer-visible documents shown on the public quote-acceptance page. Pulls
// anything flagged visible that hangs off the quote itself, its job, or the
// owning customer — via the admin client, since the caller is anonymous (but
// token-verified upstream).
export async function listPublicDocumentsForQuote(
  quoteId: string,
  jobId: string,
  customerId: string,
): Promise<PublicDocument[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('documents')
    .select('id, document_type, file_name, file_size_bytes, storage_path')
    .eq('is_customer_visible', true)
    .is('deleted_at', null)
    .or(
      `parent_quote_id.eq.${quoteId},parent_job_id.eq.${jobId},parent_customer_id.eq.${customerId}`,
    )
    .order('uploaded_at', { ascending: false })
    .limit(50);
  return ((data ?? []) as Array<Record<string, unknown>>).map((raw) => ({
    id: raw.id as string,
    document_type: raw.document_type as DocumentType,
    file_name: raw.file_name as string,
    file_size_bytes: Number(raw.file_size_bytes ?? 0),
    storage_path: raw.storage_path as string,
  }));
}

export interface SignedPublicDocument {
  id: string;
  document_type: DocumentType;
  file_name: string;
  file_size_bytes: number;
  url: string;
}

// Mints short-lived signed URLs for the customer-visible documents in one batch
// (admin client, anonymous caller). Rows whose signing fails are dropped rather
// than rendered as dead links.
export async function signPublicDocuments(
  docs: PublicDocument[],
): Promise<SignedPublicDocument[]> {
  if (docs.length === 0) return [];
  const supabase = createAdminClient();
  const { data } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrls(
      docs.map((d) => d.storage_path),
      PUBLIC_DOWNLOAD_URL_TTL_SECONDS,
    );
  const byPath = new Map((data ?? []).map((entry) => [entry.path, entry.signedUrl]));
  return docs.flatMap((doc) => {
    const url = byPath.get(doc.storage_path);
    if (!url) return [];
    return [
      {
        id: doc.id,
        document_type: doc.document_type,
        file_name: doc.file_name,
        file_size_bytes: doc.file_size_bytes,
        url,
      },
    ];
  });
}
