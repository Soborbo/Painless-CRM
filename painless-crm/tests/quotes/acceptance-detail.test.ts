import { flattenQuoteAcceptanceRow } from '@/lib/queries/quotes';
import { describe, expect, it } from 'vitest';

describe('flattenQuoteAcceptanceRow', () => {
  it('returns null when the row is null or undefined', () => {
    expect(flattenQuoteAcceptanceRow(null)).toBeNull();
    expect(flattenQuoteAcceptanceRow(undefined)).toBeNull();
  });

  it('extracts acceptor name from consents.accepted_full_name', () => {
    const out = flattenQuoteAcceptanceRow({
      accepted_at: '2026-05-06T10:00:00Z',
      consents: { accepted_full_name: 'Jane Doe', terms_accepted: true },
      variant: null,
    });
    expect(out?.acceptor_name).toBe('Jane Doe');
    expect(out?.accepted_at).toBe('2026-05-06T10:00:00Z');
  });

  it('falls back to null name when consents are missing or malformed', () => {
    expect(
      flattenQuoteAcceptanceRow({
        accepted_at: '2026-05-06T10:00:00Z',
        consents: null,
        variant: null,
      })?.acceptor_name,
    ).toBeNull();
    expect(
      flattenQuoteAcceptanceRow({
        accepted_at: '2026-05-06T10:00:00Z',
        consents: { terms_accepted: true },
        variant: null,
      })?.acceptor_name,
    ).toBeNull();
  });

  it('flattens a single-object embedded variant', () => {
    const out = flattenQuoteAcceptanceRow({
      accepted_at: '2026-05-06T10:00:00Z',
      consents: { accepted_full_name: 'Jane' },
      variant: { id: 'v-1', variant_label: 'Premium', total_pence: 25000 },
    });
    expect(out?.variant_id).toBe('v-1');
    expect(out?.variant_label).toBe('Premium');
    expect(out?.variant_total_pence).toBe(25000);
  });

  it('flattens an array-shaped embedded variant (PostgREST quirk)', () => {
    const out = flattenQuoteAcceptanceRow({
      accepted_at: '2026-05-06T10:00:00Z',
      consents: { accepted_full_name: 'Jane' },
      variant: [{ id: 'v-2', variant_label: 'Pickup Only', total_pence: 12000 }],
    });
    expect(out?.variant_id).toBe('v-2');
    expect(out?.variant_label).toBe('Pickup Only');
    expect(out?.variant_total_pence).toBe(12000);
  });

  it('returns null variant fields when no variant was chosen', () => {
    const out = flattenQuoteAcceptanceRow({
      accepted_at: '2026-05-06T10:00:00Z',
      consents: { accepted_full_name: 'Jane' },
      variant: null,
    });
    expect(out?.variant_id).toBeNull();
    expect(out?.variant_label).toBeNull();
    expect(out?.variant_total_pence).toBeNull();
  });

  it('treats an empty variant array as no variant', () => {
    const out = flattenQuoteAcceptanceRow({
      accepted_at: '2026-05-06T10:00:00Z',
      consents: null,
      variant: [],
    });
    expect(out?.variant_id).toBeNull();
    expect(out?.variant_label).toBeNull();
  });
});
