import {
  type ReportJobRow,
  aggregateBySource,
  aggregateFunnel,
  reportTotals,
} from '@/lib/reports/funnel';
import { describe, expect, it } from 'vitest';

const T = '2026-05-01T00:00:00Z';

// Helper to build a job row at a given funnel depth.
function job(
  source: string | null,
  reached: { contacted?: boolean; quoted?: boolean; accepted?: boolean; won?: boolean },
  total = 100_000,
): ReportJobRow {
  return {
    acquisition_source: source,
    contacted_at: reached.contacted ? T : null,
    quoted_at: reached.quoted ? T : null,
    accepted_at: reached.accepted ? T : null,
    paid_at: reached.won ? T : null,
    quote_total_pence: total,
  };
}

// 5 enquiries; 4 contacted; 3 quoted; 2 accepted; 1 won.
const ROWS: ReportJobRow[] = [
  job('google_ads', { contacted: true, quoted: true, accepted: true, won: true }),
  job('google_ads', { contacted: true, quoted: true, accepted: true }),
  job('website', { contacted: true, quoted: true }),
  job('website', { contacted: true }),
  job(null, {}),
];

describe('aggregateFunnel', () => {
  it('counts each milestone a job has reached (cohort model)', () => {
    const f = aggregateFunnel(ROWS);
    expect(f.map((s) => [s.key, s.count])).toEqual([
      ['enquiries', 5],
      ['contacted', 4],
      ['quoted', 3],
      ['accepted', 2],
      ['won', 1],
    ]);
  });

  it('computes share-of-top and share-of-previous', () => {
    const f = aggregateFunnel(ROWS);
    expect(f[0]?.ofTopPct).toBe(100);
    expect(f[0]?.ofPrevPct).toBeNull();
    expect(f[1]?.ofTopPct).toBe(80); // 4/5
    expect(f[1]?.ofPrevPct).toBe(80); // 4/5
    expect(f[2]?.ofPrevPct).toBe(75); // 3/4
    expect(f[4]?.ofTopPct).toBe(20); // 1/5
    expect(f[4]?.ofPrevPct).toBe(50); // 1/2
  });

  it('returns null percentages for an empty cohort', () => {
    const f = aggregateFunnel([]);
    expect(f.every((s) => s.count === 0)).toBe(true);
    expect(f[0]?.ofTopPct).toBeNull();
  });
});

describe('aggregateBySource', () => {
  it('groups leads/quoted/won and revenue per source, sorted by leads', () => {
    const s = aggregateBySource(ROWS);
    expect(s.map((r) => r.source)).toEqual(['google_ads', 'website', 'unknown']);
    const google = s.find((r) => r.source === 'google_ads');
    expect(google).toMatchObject({ leads: 2, quoted: 2, won: 1, revenuePence: 100_000 });
    expect(google?.conversionPct).toBe(50); // 1 won / 2 leads
  });

  it('buckets a null source as "unknown"', () => {
    const s = aggregateBySource([job(null, {})]);
    expect(s[0]?.source).toBe('unknown');
    expect(s[0]?.conversionPct).toBe(0);
  });

  it('only counts revenue for won jobs', () => {
    const s = aggregateBySource([job('x', { quoted: true }, 500_000)]);
    expect(s[0]?.revenuePence).toBe(0);
  });
});

describe('reportTotals', () => {
  it('summarises the cohort', () => {
    expect(reportTotals(ROWS)).toEqual({
      enquiries: 5,
      quoted: 3,
      won: 1,
      revenuePence: 100_000,
      conversionPct: 20,
    });
  });

  it('handles an empty cohort with a null conversion', () => {
    expect(reportTotals([])).toEqual({
      enquiries: 0,
      quoted: 0,
      won: 0,
      revenuePence: 0,
      conversionPct: null,
    });
  });
});
