import type { SourceAttribution } from '@/lib/reports/attribution';
import {
  buildTriggerReport,
  evaluateSource,
  isPausableSource,
} from '@/lib/reports/lead-quality-triggers';
import { describe, expect, it } from 'vitest';

function src(o: Partial<SourceAttribution>): SourceAttribution {
  return {
    source: 'google_ads',
    leads: 0,
    quoted: 0,
    won: 0,
    revenuePence: 0,
    conversionPct: null,
    avgJobValuePence: null,
    wonCustomers: 0,
    repeatRatePct: 0,
    ltvPence: null,
    score: 0,
    ...o,
  };
}

describe('isPausableSource', () => {
  it('treats ad platforms as pausable, organic/referral as not', () => {
    expect(isPausableSource('google_ads')).toBe(true);
    expect(isPausableSource('meta_ads')).toBe(true);
    expect(isPausableSource('referral')).toBe(false);
    expect(isPausableSource('organic')).toBe(false);
    expect(isPausableSource('unknown')).toBe(false);
  });
});

describe('evaluateSource', () => {
  it('flags a paid source with enough leads and sub-floor conversion', () => {
    const v = evaluateSource(src({ source: 'google_ads', leads: 20, conversionPct: 2 }));
    expect(v.underperforming).toBe(true);
    expect(v.reason).toContain('2.0% conversion');
  });

  it('does not flag a paid source above the conversion floor', () => {
    const v = evaluateSource(src({ source: 'google_ads', leads: 20, conversionPct: 12 }));
    expect(v.underperforming).toBe(false);
  });

  it('does not flag a paid source without enough leads (too little signal)', () => {
    const v = evaluateSource(src({ source: 'meta_ads', leads: 3, conversionPct: 0 }));
    expect(v.underperforming).toBe(false);
  });

  it('never flags a non-pausable source even with poor conversion', () => {
    const v = evaluateSource(src({ source: 'referral', leads: 50, conversionPct: 1 }));
    expect(v.underperforming).toBe(false);
    expect(v.reason).toBeNull();
  });

  it('treats null conversion as zero', () => {
    const v = evaluateSource(src({ source: 'google_ads', leads: 15, conversionPct: null }));
    expect(v.underperforming).toBe(true);
  });

  it('honours custom thresholds', () => {
    const v = evaluateSource(src({ source: 'google_ads', leads: 8, conversionPct: 4 }), {
      minLeads: 5,
      minConversionPct: 10,
    });
    expect(v.underperforming).toBe(true);
  });
});

describe('buildTriggerReport', () => {
  it('collects underperformers and maps every source to a verdict', () => {
    const { verdicts, underperformers } = buildTriggerReport([
      src({ source: 'google_ads', leads: 20, conversionPct: 1 }),
      src({ source: 'meta_ads', leads: 20, conversionPct: 30 }),
      src({ source: 'referral', leads: 20, conversionPct: 1 }),
    ]);
    expect(underperformers.map((v) => v.source)).toEqual(['google_ads']);
    expect(verdicts.size).toBe(3);
    expect(verdicts.get('meta_ads')?.underperforming).toBe(false);
  });
});
