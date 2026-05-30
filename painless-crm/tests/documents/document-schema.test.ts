import { SoftDeleteDocumentSchema, UploadDocumentSchema } from '@/lib/schemas/document';
import { describe, expect, it } from 'vitest';

const JOB_ID = '11111111-1111-1111-1111-111111111111';
const DOC_ID = '22222222-2222-2222-2222-222222222222';

describe('UploadDocumentSchema', () => {
  it('accepts a valid job upload and coerces the visibility checkbox', () => {
    const out = UploadDocumentSchema.parse({
      parent_type: 'job',
      parent_id: JOB_ID,
      document_type: 'parking_permit',
      is_customer_visible: 'on',
      notes: '  bay 3 reserved  ',
    });
    expect(out.is_customer_visible).toBe(true);
    expect(out.notes).toBe('bay 3 reserved');
  });

  it('defaults visibility to false (private) when the toggle is absent', () => {
    const out = UploadDocumentSchema.parse({
      parent_type: 'customer',
      parent_id: JOB_ID,
      document_type: 'other',
    });
    expect(out.is_customer_visible).toBe(false);
    expect(out.notes).toBeNull();
  });

  it('rejects an unknown document_type (must match the DB constraint)', () => {
    const res = UploadDocumentSchema.safeParse({
      parent_type: 'job',
      parent_id: JOB_ID,
      document_type: 'malware',
    });
    expect(res.success).toBe(false);
  });

  it('rejects an unsupported parent_type', () => {
    const res = UploadDocumentSchema.safeParse({
      parent_type: 'quote',
      parent_id: JOB_ID,
      document_type: 'signed_quote_pdf',
    });
    expect(res.success).toBe(false);
  });

  it('rejects a non-uuid parent_id', () => {
    const res = UploadDocumentSchema.safeParse({
      parent_type: 'job',
      parent_id: 'not-a-uuid',
      document_type: 'other',
    });
    expect(res.success).toBe(false);
  });
});

describe('SoftDeleteDocumentSchema', () => {
  it('requires id, parent_type and parent_id', () => {
    expect(
      SoftDeleteDocumentSchema.safeParse({ id: DOC_ID, parent_type: 'job', parent_id: JOB_ID })
        .success,
    ).toBe(true);
    expect(SoftDeleteDocumentSchema.safeParse({ id: DOC_ID }).success).toBe(false);
  });
});
