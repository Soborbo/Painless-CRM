// Document vault — Phase 06b §7 (ADR-018). Shared constants for the metadata
// table and the upload surface. DOCUMENT_TYPES mirrors the CHECK constraint on
// `documents.document_type` exactly — keep the two in lockstep.

export const DOCUMENT_TYPES = [
  'terms_accepted',
  'parking_permit',
  'insurance_certificate',
  'signed_quote_pdf',
  'invoice_pdf',
  'floor_plan',
  'inventory_list',
  'damage_report',
  'identification',
  'other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// v0.1 light scope: uploads land on a customer or a job. Quote/invoice parents
// exist in the schema for system-generated PDFs and are surfaced read-only.
export const UPLOAD_PARENT_TYPES = ['customer', 'job'] as const;
export type UploadParentType = (typeof UPLOAD_PARENT_TYPES)[number];

export const STORAGE_BUCKET = 'documents';

// 25 MB ceiling. Big enough for scanned PDFs and floor plans, small enough to
// stay well under the Cloudflare Workers request body limit and Supabase
// Storage's per-object default.
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// Allow-list rather than block-list — the vault holds permits, certificates,
// signed PDFs and photos, not arbitrary binaries.
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
] as const;

// Signed download URLs are short-lived — the office user is actively clicking,
// so a minute is plenty and limits how long a leaked URL stays usable.
export const DOWNLOAD_URL_TTL_SECONDS = 60;

// The public quote page renders links server-side, so the customer may click a
// little later than an office user — give those a slightly longer window.
export const PUBLIC_DOWNLOAD_URL_TTL_SECONDS = 300;
