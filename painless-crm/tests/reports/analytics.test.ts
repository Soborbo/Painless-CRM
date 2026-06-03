import {
  type AnalyticsJobRow,
  WIN_PROBABILITY_BY_STAGE,
  bySource,
  byStatus,
  byType,
  projectedRevenue,
  quoteConversionByStaff,
} from '@/lib/reports/analytics';
import { describe, expect, it } from 'vitest';

function row(over: Partial<AnalyticsJobRow>): AnalyticsJobRow {
  return {
    stage: 'lead',
    service_type: 'removal',
    acquisition_source: 'google_ads',
    assigned_to_id: null,
    assigned_to_name: null,
    quoted_at: null,
    paid_at: null,
    quote_total_pence: null,
    ...over,
  };
}

describe('byType', () => {
  it('counts by service_type, nulls become unknown, sorted desc', () => {
    const out = byType([
      row({ service_type: 'removal' }),
      row({ service_type: 'removal' }),
      row({ service_type: 'storage' }),
      row({ service_type: null }),
    ]);
    expect(out).toEqual([
      { key: 'removal', count: 2 },
      { key: 'storage', count: 1 },
      { key: 'unknown', count: 1 },
    ]);
  });

  it('is empty for no rows', () => {
    expect(byType([])).toEqual([]);
  });
});

describe('byStatus', () => {
  it('orders along the canonical lifecycle, not by count', () => {
    const out = byStatus([
      row({ stage: 'paid' }),
      row({ stage: 'paid' }),
      row({ stage: 'lead' }),
      row({ stage: 'quoted' }),
    ]);
    expect(out.map((c) => c.key)).toEqual(['lead', 'quoted', 'paid']);
    expect(out.find((c) => c.key === 'paid')?.count).toBe(2);
  });
});

describe('bySource', () => {
  it('counts by acquisition_source, nulls become unknown', () => {
    const out = bySource([
      row({ acquisition_source: 'google_ads' }),
      row({ acquisition_source: null }),
    ]);
    expect(out).toEqual([
      { key: 'google_ads', count: 1 },
      { key: 'unknown', count: 1 },
    ]);
  });
});

describe('quoteConversionByStaff', () => {
  it('counts only quoted rows and computes won/quoted', () => {
    const out = quoteConversionByStaff([
      row({ assigned_to_id: 'u1', assigned_to_name: 'Ann', quoted_at: 'x', paid_at: 'y' }),
      row({ assigned_to_id: 'u1', assigned_to_name: 'Ann', quoted_at: 'x' }),
      row({ assigned_to_id: 'u2', assigned_to_name: 'Bob', quoted_at: 'x' }),
      row({ assigned_to_id: 'u3', assigned_to_name: 'Cid' }), // no quote → excluded
    ]);
    const ann = out.find((s) => s.assignedToId === 'u1');
    expect(ann).toMatchObject({ quoted: 2, won: 1, conversionPct: 50 });
    expect(out.find((s) => s.assignedToId === 'u3')).toBeUndefined();
  });

  it('buckets unassigned quotes under a single lane', () => {
    const out = quoteConversionByStaff([row({ quoted_at: 'x' }), row({ quoted_at: 'x' })]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ assignedToId: 'unassigned', name: 'Unassigned', quoted: 2 });
  });
});

describe('projectedRevenue', () => {
  it('weights open quote value by stage probability and excludes paid/terminal', () => {
    const out = projectedRevenue([
      row({ stage: 'quoted', quote_total_pence: 100_00 }), // ×0.35 = 3500
      row({ stage: 'accepted', quote_total_pence: 100_00 }), // ×0.75 = 7500
      row({ stage: 'paid', quote_total_pence: 100_00 }), // excluded
      row({ stage: 'dead', quote_total_pence: 100_00 }), // excluded
    ]);
    expect(out).toBe(Math.round(100_00 * (WIN_PROBABILITY_BY_STAGE.quoted as number) + 100_00 * (WIN_PROBABILITY_BY_STAGE.accepted as number)));
    expect(out).toBe(11_000);
  });

  it('is 0 with no open pipeline', () => {
    expect(projectedRevenue([row({ stage: 'paid', quote_total_pence: 50_00 })])).toBe(0);
    expect(projectedRevenue([])).toBe(0);
  });
});
