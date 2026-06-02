import { type AttributionJobRow, buildSourceAttribution } from '@/lib/reports/attribution';
import { describe, expect, it } from 'vitest';

function row(o: Partial<AttributionJobRow>): AttributionJobRow {
  return {
    acquisition_source: 'google',
    customer_id: 'c1',
    quoted_at: null,
    paid_at: null,
    quote_total_pence: null,
    ...o,
  };
}

describe('buildSourceAttribution', () => {
  it('aggregates leads/quoted/won/revenue and conversion per source', () => {
    const out = buildSourceAttribution([
      row({
        acquisition_source: 'google',
        customer_id: 'c1',
        quoted_at: 'x',
        paid_at: 'y',
        quote_total_pence: 100_00,
      }),
      row({ acquisition_source: 'google', customer_id: 'c2', quoted_at: 'x' }),
      row({ acquisition_source: 'referral', customer_id: 'c3' }),
    ]);
    const google = out.find((s) => s.source === 'google');
    expect(google).toMatchObject({ leads: 2, quoted: 2, won: 1, revenuePence: 100_00 });
    expect(google?.conversionPct).toBe(50);
    expect(google?.avgJobValuePence).toBe(100_00);
    const referral = out.find((s) => s.source === 'referral');
    expect(referral?.conversionPct).toBe(0);
    expect(referral?.avgJobValuePence).toBeNull();
  });

  it('buckets a null source as "unknown"', () => {
    const out = buildSourceAttribution([row({ acquisition_source: null })]);
    expect(out[0]?.source).toBe('unknown');
  });

  it('computes LTV per winning customer and repeat rate', () => {
    // c1 wins twice, c2 once → 3 wins, 2 customers, 1 repeat-extra → 33%.
    const out = buildSourceAttribution([
      row({ customer_id: 'c1', paid_at: 'y', quote_total_pence: 100_00 }),
      row({ customer_id: 'c1', paid_at: 'y', quote_total_pence: 200_00 }),
      row({ customer_id: 'c2', paid_at: 'y', quote_total_pence: 300_00 }),
    ]);
    const g = out[0];
    expect(g?.won).toBe(3);
    expect(g?.wonCustomers).toBe(2);
    expect(g?.ltvPence).toBe(300_00); // 600,00 / 2
    expect(Math.round(g?.repeatRatePct ?? 0)).toBe(33);
  });

  it('ranks higher conversion × value above generic clicks, and repeats lift the score', () => {
    const out = buildSourceAttribution([
      // referral: 1 lead, 1 win, £1000 → conv 1.0 × 1000 = 1000
      row({
        acquisition_source: 'referral',
        customer_id: 'r1',
        paid_at: 'y',
        quote_total_pence: 1000_00,
      }),
      // google: 4 leads, 1 win, £200 → conv 0.25 × 200 = 50
      row({
        acquisition_source: 'google',
        customer_id: 'g1',
        paid_at: 'y',
        quote_total_pence: 200_00,
      }),
      row({ acquisition_source: 'google', customer_id: 'g2' }),
      row({ acquisition_source: 'google', customer_id: 'g3' }),
      row({ acquisition_source: 'google', customer_id: 'g4' }),
    ]);
    expect(out[0]?.source).toBe('referral');
    expect(out[0]?.score ?? 0).toBeGreaterThan(out[1]?.score ?? 0);
  });

  it('gives a zero score to sources with no wins', () => {
    const out = buildSourceAttribution([row({ paid_at: null })]);
    expect(out[0]?.score).toBe(0);
  });
});
