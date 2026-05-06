import { type HeadlineCandidate, pickHeadlineQuote } from '@/lib/quotes/headline';
import { describe, expect, it } from 'vitest';

function row(overrides: Partial<HeadlineCandidate>): HeadlineCandidate {
  return {
    id: overrides.id ?? 'q-default',
    total_pence: overrides.total_pence ?? 1000,
    status: overrides.status ?? 'draft',
    created_at: overrides.created_at ?? '2026-05-01T00:00:00Z',
  };
}

describe('pickHeadlineQuote', () => {
  it('returns null when there are no quotes', () => {
    expect(pickHeadlineQuote([])).toBeNull();
  });

  it('prefers an accepted quote over any other status', () => {
    const out = pickHeadlineQuote([
      row({ id: 'd', status: 'draft', created_at: '2026-05-04T00:00:00Z', total_pence: 12000 }),
      row({ id: 's', status: 'sent', created_at: '2026-05-03T00:00:00Z', total_pence: 11000 }),
      row({ id: 'a', status: 'accepted', created_at: '2026-05-01T00:00:00Z', total_pence: 10000 }),
    ]);
    expect(out?.id).toBe('a');
    expect(out?.total_pence).toBe(10000);
  });

  it('chooses the latest accepted when multiple acceptances exist', () => {
    const out = pickHeadlineQuote([
      row({ id: 'a1', status: 'accepted', created_at: '2026-05-01T00:00:00Z' }),
      row({ id: 'a2', status: 'accepted', created_at: '2026-05-03T00:00:00Z' }),
      row({ id: 'a3', status: 'accepted', created_at: '2026-05-02T00:00:00Z' }),
    ]);
    expect(out?.id).toBe('a2');
  });

  it('falls back to the latest sent when no accepted exists', () => {
    const out = pickHeadlineQuote([
      row({ id: 'd', status: 'draft', created_at: '2026-05-04T00:00:00Z' }),
      row({ id: 's1', status: 'sent', created_at: '2026-05-02T00:00:00Z' }),
      row({ id: 's2', status: 'sent', created_at: '2026-05-03T00:00:00Z' }),
    ]);
    expect(out?.id).toBe('s2');
  });

  it('falls back to draft when no accepted/sent exists', () => {
    const out = pickHeadlineQuote([
      row({ id: 'd1', status: 'draft', created_at: '2026-05-04T00:00:00Z' }),
      row({ id: 'd2', status: 'draft', created_at: '2026-05-05T00:00:00Z' }),
    ]);
    expect(out?.id).toBe('d2');
  });

  it('falls back through declined and expired only as a last resort', () => {
    const out = pickHeadlineQuote([
      row({ id: 'e', status: 'expired', created_at: '2026-05-04T00:00:00Z' }),
      row({ id: 'x', status: 'declined', created_at: '2026-05-03T00:00:00Z' }),
    ]);
    expect(out?.id).toBe('x');
  });

  it('returns the only expired quote if nothing else is present', () => {
    const out = pickHeadlineQuote([
      row({ id: 'e', status: 'expired', created_at: '2026-05-04T00:00:00Z' }),
    ]);
    expect(out?.id).toBe('e');
  });

  it('skips quotes with null status when computing priority', () => {
    const out = pickHeadlineQuote([
      row({ id: 'unknown', status: null, created_at: '2026-05-05T00:00:00Z' }),
      row({ id: 's', status: 'sent', created_at: '2026-05-04T00:00:00Z' }),
    ]);
    expect(out?.id).toBe('s');
  });
});
