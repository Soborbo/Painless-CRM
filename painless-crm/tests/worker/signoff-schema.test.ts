import { SignoffSchema } from '@/lib/schemas/signoff';
import { describe, expect, it } from 'vitest';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const base = {
  job_id: '11111111-1111-1111-1111-111111111111',
  client_event_id: '22222222-2222-2222-2222-222222222222',
  signature_data_url: PNG,
};

describe('SignoffSchema', () => {
  it('accepts a minimal valid sign-off', () => {
    const r = SignoffSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.internal_rating_1_5).toBeNull();
      expect(r.data.email_confirmed).toBe(false);
    }
  });

  it('requires a signature image and rejects non-image data URLs', () => {
    expect(SignoffSchema.safeParse({ ...base, signature_data_url: '' }).success).toBe(false);
    expect(
      SignoffSchema.safeParse({ ...base, signature_data_url: 'data:text/html,<script>' }).success,
    ).toBe(false);
    expect(
      SignoffSchema.safeParse({ ...base, signature_data_url: 'https://evil.example/x.png' })
        .success,
    ).toBe(false);
  });

  it('rejects an internal rating outside 1–5 but accepts blank', () => {
    expect(SignoffSchema.safeParse({ ...base, internal_rating_1_5: '6' }).success).toBe(false);
    expect(SignoffSchema.safeParse({ ...base, internal_rating_1_5: '0' }).success).toBe(false);
    const ok = SignoffSchema.safeParse({ ...base, internal_rating_1_5: '4' });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.internal_rating_1_5).toBe(4);
    const blank = SignoffSchema.safeParse({ ...base, internal_rating_1_5: '' });
    expect(blank.success).toBe(true);
    if (blank.success) expect(blank.data.internal_rating_1_5).toBeNull();
  });

  it('coerces the email confirmation flag', () => {
    const r = SignoffSchema.safeParse({ ...base, email_confirmed: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email_confirmed).toBe(true);
  });
});
