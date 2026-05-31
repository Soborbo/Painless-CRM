import { MAX_FILE_SIZE_BYTES } from '@/lib/documents/constants';
import {
  buildStoragePath,
  formatFileSize,
  sanitizeFileName,
  validateUpload,
} from '@/lib/documents/storage-path';
import { describe, expect, it } from 'vitest';

describe('sanitizeFileName', () => {
  it('keeps a plain safe filename intact', () => {
    expect(sanitizeFileName('parking-permit_2026.pdf')).toBe('parking-permit_2026.pdf');
  });

  it('strips directory components and path traversal', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('C:\\Users\\jay\\floor plan.png')).toBe('floor_plan.png');
  });

  it('collapses unsafe characters and whitespace to single underscores', () => {
    expect(sanitizeFileName('my  invoice (final).pdf')).toBe('my_invoice_final_.pdf');
  });

  it('drops leading dots so it can never become a hidden-file key', () => {
    expect(sanitizeFileName('...secret.pdf')).toBe('secret.pdf');
  });

  it('falls back to "file" when nothing usable remains', () => {
    expect(sanitizeFileName('////')).toBe('file');
    expect(sanitizeFileName('')).toBe('file');
  });

  it('caps very long names to the trailing 120 chars', () => {
    const long = `${'a'.repeat(200)}.pdf`;
    const out = sanitizeFileName(long);
    expect(out.length).toBe(120);
    expect(out.endsWith('.pdf')).toBe(true);
  });
});

describe('buildStoragePath', () => {
  it('puts company_id first so the storage RLS policy can scope on it', () => {
    const path = buildStoragePath('comp-1', 'doc-9', 'permit.pdf');
    expect(path).toBe('comp-1/documents/doc-9/permit.pdf');
    expect(path.split('/')[0]).toBe('comp-1');
  });

  it('sanitizes the filename segment', () => {
    expect(buildStoragePath('c', 'd', '../evil name.pdf')).toBe('c/documents/d/evil_name.pdf');
  });
});

describe('validateUpload', () => {
  it('rejects empty files', () => {
    expect(validateUpload({ size: 0, mimeType: 'application/pdf' })).toEqual({
      ok: false,
      reason: 'empty',
    });
  });

  it('rejects files over the size ceiling', () => {
    expect(validateUpload({ size: MAX_FILE_SIZE_BYTES + 1, mimeType: 'application/pdf' })).toEqual({
      ok: false,
      reason: 'too_large',
    });
  });

  it('accepts a file exactly at the ceiling', () => {
    expect(validateUpload({ size: MAX_FILE_SIZE_BYTES, mimeType: 'application/pdf' })).toEqual({
      ok: true,
    });
  });

  it('rejects disallowed MIME types', () => {
    expect(validateUpload({ size: 10, mimeType: 'application/x-msdownload' })).toEqual({
      ok: false,
      reason: 'mime',
    });
  });

  it('accepts an allowed image type', () => {
    expect(validateUpload({ size: 10, mimeType: 'image/png' })).toEqual({ ok: true });
  });
});

describe('formatFileSize', () => {
  it('handles zero and negatives', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(-5)).toBe('0 B');
  });

  it('formats bytes without decimals', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats kilobytes and megabytes with one decimal', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
  });
});
