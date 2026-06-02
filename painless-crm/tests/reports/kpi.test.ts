import {
  type KpiCounts,
  buildKpiMetrics,
  isKpiPeriod,
  kpiWindows,
} from '@/lib/reports/kpi';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-06-02T00:00:00Z');

function counts(o: Partial<KpiCounts>): KpiCounts {
  return { leads: 0, quotesSent: 0, quotesAccepted: 0, won: 0, revenuePence: 0, ...o };
}

describe('kpiWindows', () => {
  it('returns symmetric current + previous windows for a week', () => {
    const w = kpiWindows(NOW, 'week');
    expect(w.current.endIso).toBe('2026-06-02T00:00:00.000Z');
    expect(w.current.startIso).toBe('2026-05-26T00:00:00.000Z');
    // previous window abuts the current one and is the same length
    expect(w.previous.endIso).toBe(w.current.startIso);
    expect(w.previous.startIso).toBe('2026-05-19T00:00:00.000Z');
  });

  it('scales the window length by period', () => {
    expect(kpiWindows(NOW, 'day').current.startIso).toBe('2026-06-01T00:00:00.000Z');
    expect(kpiWindows(NOW, 'month').current.startIso).toBe('2026-05-03T00:00:00.000Z');
  });
});

describe('isKpiPeriod', () => {
  it('accepts known periods and rejects junk', () => {
    expect(isKpiPeriod('week')).toBe(true);
    expect(isKpiPeriod('year')).toBe(false);
    expect(isKpiPeriod(undefined)).toBe(false);
  });
});

describe('buildKpiMetrics', () => {
  it('computes percentage deltas and direction', () => {
    const metrics = buildKpiMetrics(
      counts({ leads: 12, revenuePence: 200_00 }),
      counts({ leads: 10, revenuePence: 100_00 }),
    );
    const leads = metrics.find((m) => m.key === 'leads');
    expect(leads).toMatchObject({ current: 12, previous: 10, direction: 'up' });
    expect(leads?.deltaPct).toBeCloseTo(20);
    const revenue = metrics.find((m) => m.key === 'revenuePence');
    expect(revenue?.isMoney).toBe(true);
    expect(revenue?.deltaPct).toBeCloseTo(100);
  });

  it('marks a decrease as down', () => {
    const metrics = buildKpiMetrics(counts({ won: 3 }), counts({ won: 6 }));
    const won = metrics.find((m) => m.key === 'won');
    expect(won?.direction).toBe('down');
    expect(won?.deltaPct).toBeCloseTo(-50);
  });

  it('returns a null delta (not Infinity) when the baseline was zero', () => {
    const metrics = buildKpiMetrics(counts({ leads: 5 }), counts({ leads: 0 }));
    const leads = metrics.find((m) => m.key === 'leads');
    expect(leads?.deltaPct).toBeNull();
    expect(leads?.direction).toBe('up');
  });

  it('treats equal values as flat with a zero delta', () => {
    const metrics = buildKpiMetrics(counts({ leads: 4 }), counts({ leads: 4 }));
    const leads = metrics.find((m) => m.key === 'leads');
    expect(leads?.direction).toBe('flat');
    expect(leads?.deltaPct).toBe(0);
  });

  it('returns a null delta for two zero windows', () => {
    const metrics = buildKpiMetrics(counts({}), counts({}));
    expect(metrics.find((m) => m.key === 'leads')?.deltaPct).toBeNull();
  });
});
