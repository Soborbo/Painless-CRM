import {
  ALLOWED_MIME_TYPES,
  type DocumentType,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/documents/constants';

// Pure helpers for the document vault — no Supabase, no I/O — so the path
// layout and the upload guard rails can be unit-tested without a live backend.

// Reduce an uploaded filename to a safe object-key segment. Anything that isn't
// an ASCII letter, digit, dot, underscore or hyphen — path separators, spaces,
// control characters, unicode — collapses to a single underscore, so the result
// can never escape the company folder or break the storage key. Leading dots
// are dropped to avoid hidden-file keys, and the length is capped.
export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[/\\]/).pop() ?? '';
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^\.+/, '')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');
  const safe = cleaned.length > 0 ? cleaned : 'file';
  return safe.length > 120 ? safe.slice(-120) : safe;
}

// Canonical object key: {company_id}/documents/{document_id}/{filename}.
// The first segment is what the Storage RLS policy keys off, so it must always
// be the owning company_id.
export function buildStoragePath(companyId: string, documentId: string, fileName: string): string {
  return `${companyId}/documents/${documentId}/${sanitizeFileName(fileName)}`;
}

export interface UploadCandidate {
  size: number;
  mimeType: string;
}

export type UploadValidation = { ok: true } | { ok: false; reason: 'empty' | 'too_large' | 'mime' };

// Server-side guard mirrored from the Zod schema and the DB constraints. Kept
// pure and separate so the size/MIME rules are testable in isolation.
export function validateUpload(candidate: UploadCandidate): UploadValidation {
  if (candidate.size <= 0) return { ok: false, reason: 'empty' };
  if (candidate.size > MAX_FILE_SIZE_BYTES) return { ok: false, reason: 'too_large' };
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(candidate.mimeType)) {
    return { ok: false, reason: 'mime' };
  }
  return { ok: true };
}

// Human-readable file size for list rows. Pure so it can be tested at the
// boundaries (0 B, exactly 1 KB, MB rounding).
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const rounded = exponent === 0 ? value : Math.round(value * 10) / 10;
  return `${rounded} ${units[exponent]}`;
}

export function isKnownDocumentType(
  value: string,
  known: readonly DocumentType[],
): value is DocumentType {
  return (known as readonly string[]).includes(value);
}
