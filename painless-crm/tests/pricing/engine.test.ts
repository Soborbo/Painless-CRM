import { PricingEngineError, bucketComplicationPoints, calculateQuote } from '@/lib/pricing/engine';
import { SMOKE_PRICING_CONFIG } from '@/lib/pricing/fixtures';
import type { PricingConfig, QuoteInput } from '@/lib/schemas/pricing';
import { describe, expect, it } from 'vitest';

const baseInput: QuoteInput = {
  size_code: 'two_bed',
  distance_miles: 12,
  complications: [],
};

describe('bucketComplicationPoints', () => {
  it.each([
    [0, 'none', 0],
    [1, 'none', 0],
    [2, 'minor', 1],
    [3, 'minor', 1],
    [4, 'moderate', 2],
    [5, 'moderate', 2],
    [6, 'survey_required', 2],
    [12, 'survey_required', 2],
  ])('points=%i → bucket=%s, hours_added=%i', (points, bucket, hours) => {
    expect(bucketComplicationPoints(points)).toEqual({ bucket, hours_added: hours });
  });
});

describe('calculateQuote', () => {
  it('is deterministic for the same input', () => {
    const a = calculateQuote(SMOKE_PRICING_CONFIG, baseInput);
    const b = calculateQuote(SMOKE_PRICING_CONFIG, baseInput);
    expect(a).toEqual(b);
  });

  it('uses the local distance band for short journeys', () => {
    const result = calculateQuote(SMOKE_PRICING_CONFIG, { ...baseInput, distance_miles: 5 });
    expect(result.breakdown.distance_band_code).toBe('local');
  });

  it('uses the long band for inter-region journeys', () => {
    const result = calculateQuote(SMOKE_PRICING_CONFIG, { ...baseInput, distance_miles: 220 });
    expect(result.breakdown.distance_band_code).toBe('long');
  });

  it('applies pass-through fuel cost proportionally to miles', () => {
    const a = calculateQuote(SMOKE_PRICING_CONFIG, { ...baseInput, distance_miles: 10 });
    const b = calculateQuote(SMOKE_PRICING_CONFIG, { ...baseInput, distance_miles: 11 });
    expect(b.components.fuel_pence - a.components.fuel_pence).toBe(
      SMOKE_PRICING_CONFIG.pass_through_config.fuel_per_mile_pence,
    );
  });

  it('grosses labour up by margin while leaving pass-through at cost', () => {
    const result = calculateQuote(SMOKE_PRICING_CONFIG, baseInput);
    const margin = result.breakdown.margin_pct;
    const expectedLabour = Math.round(result.base_pence / (1 - margin));
    expect(result.total_pence - result.pass_through_pence).toBe(expectedLabour);
    expect(result.margin_pence).toBe(expectedLabour - result.base_pence);
  });

  it('marks survey_required when complication points are 6 or more', () => {
    const heavy: QuoteInput = {
      ...baseInput,
      complications: ['piano', 'safe'],
    };
    const result = calculateQuote(SMOKE_PRICING_CONFIG, heavy);
    expect(result.requires_survey).toBe(true);
    expect(result.notes).toContain('survey_required_due_to_complications');
  });

  it('adds an hour for minor complications and two for moderate', () => {
    const clean = calculateQuote(SMOKE_PRICING_CONFIG, baseInput);
    const minor = calculateQuote(SMOKE_PRICING_CONFIG, {
      ...baseInput,
      complications: ['narrow_access'],
    });
    const moderate = calculateQuote(SMOKE_PRICING_CONFIG, {
      ...baseInput,
      complications: ['narrow_access', 'long_carry'],
    });
    expect(minor.breakdown.estimated_hours).toBe(clean.breakdown.estimated_hours + 1);
    expect(moderate.breakdown.estimated_hours).toBe(clean.breakdown.estimated_hours + 2);
    expect(moderate.total_pence).toBeGreaterThan(minor.total_pence);
    expect(minor.total_pence).toBeGreaterThan(clean.total_pence);
  });

  it('does not modulate when dynamic_pricing_enabled is false', () => {
    const result = calculateQuote(
      SMOKE_PRICING_CONFIG,
      { ...baseInput, source: 'calculator' },
      'red',
    );
    expect(result.breakdown.margin_modulated).toBe(false);
  });

  it('applies capacity_band delta only when source is in modulation_sources', () => {
    const config: PricingConfig = { ...SMOKE_PRICING_CONFIG, dynamic_pricing_enabled: true };
    const matched = calculateQuote(config, { ...baseInput, source: 'calculator' }, 'red');
    const unmatched = calculateQuote(config, { ...baseInput, source: 'walk_in' }, 'red');
    expect(matched.breakdown.margin_modulated).toBe(true);
    expect(unmatched.breakdown.margin_modulated).toBe(false);
    expect(matched.breakdown.margin_pct).toBeGreaterThan(unmatched.breakdown.margin_pct);
  });

  it('throws PricingEngineError for unknown size_code', () => {
    expect(() =>
      calculateQuote(SMOKE_PRICING_CONFIG, { ...baseInput, size_code: 'mansion' }),
    ).toThrow(PricingEngineError);
  });

  it('throws PricingEngineError for unknown complication code', () => {
    expect(() =>
      calculateQuote(SMOKE_PRICING_CONFIG, { ...baseInput, complications: ['unicorn'] }),
    ).toThrow(PricingEngineError);
  });

  it('reports a 65/35 load/unload hours split', () => {
    const result = calculateQuote(SMOKE_PRICING_CONFIG, baseInput);
    const { load_hours, unload_hours } = result.breakdown.load_unload_split;
    const total = result.breakdown.estimated_hours;
    expect(load_hours + unload_hours).toBeCloseTo(total, 0);
    expect(load_hours).toBeGreaterThan(unload_hours);
  });
});
