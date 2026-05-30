import { DOCUMENT_TYPES, UPLOAD_PARENT_TYPES } from '@/lib/documents/constants';
import { z } from 'zod';

// Document vault — Phase 06b §7 (ADR-018). These validate the metadata the
// upload form posts alongside the file; the file bytes themselves are checked
// by `validateUpload` (size/MIME) in the Server Action.

const NOTES_MAX = 2000;

const visibilityToggle = z
  .union([z.literal('on'), z.literal('true'), z.literal('false'), z.literal('off'), z.null()])
  .optional()
  .transform((v) => v === 'on' || v === 'true');

export const UploadDocumentSchema = z.object({
  parent_type: z.enum(UPLOAD_PARENT_TYPES),
  parent_id: z.string().uuid(),
  document_type: z.enum(DOCUMENT_TYPES),
  is_customer_visible: visibilityToggle,
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>;

export const SoftDeleteDocumentSchema = z.object({
  id: z.string().uuid(),
  parent_type: z.enum(UPLOAD_PARENT_TYPES),
  parent_id: z.string().uuid(),
});

export const DownloadDocumentSchema = z.object({
  id: z.string().uuid(),
});
