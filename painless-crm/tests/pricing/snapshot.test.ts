import { SMOKE_PRICING_CONFIG } from '@/lib/pricing/fixtures';
import { buildQuoteSnapshot, classifyDrift } from '@/lib/pricing/snapshot';
import type { QuoteInput } from '@/lib/schemas/pricing';
import { describe, expect, it } from 'vitest';

const VERSION_ID = '11111111-1111-4111-8111-111111111111';
const FROZEN_NOW = new Date('2026-05-04T12:00:00Z');

const baseInput: QuoteInput = {
  size_code: 'two_bed',
  distance_miles: 12,
  complications: [],
};

describe('buildQuoteSnapshot', () => {
  it('produces a deterministic payload for the same input', () => {
    const a = buildQuoteSnapshot({
      pricingVersionId: VERSION_ID,
      config: SMOKE_PRICING_CONFIG,
      input: baseInput,
      computedAt: FROZEN_NOW,
    });
    const b = buildQuoteSnapshot({
      pricingVersionId: VERSION_ID,
      config: SMOKE_PRICING_CONFIG,
      input: baseInput,
      computedAt: FROZEN_NOW,
    });
    expect(a).toEqual(b);
  });

  it('captures the full config, input, and result inside pricing_snapshot', () => {
    const snapshot = buildQuoteSnapshot({
      pricingVersionId: VERSION_ID,
      config: SMOKE_PRICING_CONFIG,
      input: baseInput,
      computedAt: FROZEN_NOW,
    });
    expect(snapshot.pricing_snapshot.config).toEqual(SMOKE_PRICING_CONFIG);
    expect(snapshot.pricing_snapshot.input).toEqual(baseInput);
    expect(snapshot.pricing_snapshot.result.total_pence).toBe(snapshot.total_pence);
    expect(snapshot.pricing_snapshot.computed_at).toBe(FROZEN_NOW.toISOString());
  });

  it('echoes the engine output into the top-level shortcut fields', () => {
    const snapshot = buildQuoteSnapshot({
      pricingVersionId: VERSION_ID,
      config: SMOKE_PRICING_CONFIG,
      input: baseInput,
      computedAt: FROZEN_NOW,
    });
    expect(snapshot.size_code).toBe(baseInput.size_code);
    expect(snapshot.distance_miles).toBe(baseInput.distance_miles);
    expect(snapshot.complications).toEqual(baseInput.complications);
    expect(snapshot.breakdown).toEqual(snapshot.pricing_snapshot.result.breakdown);
  });

  it('computes valid_until as computed_at + quote_validity_days days', () => {
    const snapshot = buildQuoteSnapshot({
      pricingVersionId: VERSION_ID,
      config: SMOKE_PRICING_CONFIG,
      input: baseInput,
      computedAt: FROZEN_NOW,
    });
    const expected = new Date(
      FROZEN_NOW.getTime() + SMOKE_PRICING_CONFIG.quote_validity_days * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(snapshot.valid_until).toBe(expected);
  });

  it('does not mutate the input complications array', () => {
    const input: QuoteInput = { ...baseInput, complications: ['narrow_access'] };
    const snapshot = buildQuoteSnapshot({
      pricingVersionId: VERSION_ID,
      config: SMOKE_PRICING_CONFIG,
      input,
      computedAt: FROZEN_NOW,
    });
    snapshot.complications.push('mutation');
    expect(input.complications).toEqual(['narrow_access']);
  });
});

describe('buildQuoteSnapshot — capacity band threading (Phase 07)', () => {
  // dynamic pricing off (the smoke default) → band is ignored.
  const dynamicConfig = { ...SMOKE_PRICING_CONFIG, dynamic_pricing_enabled: true };
  const calculatorInput: QuoteInput = { ...baseInput, source: 'calculator' };

  it('ignores the band when dynamic pricing is disabled', () => {
    const snap = buildQuoteSnapshot({
      pricingVersionId: VERSION_ID,
      config: SMOKE_PRICING_CONFIG,
      input: calculatorInput,
      computedAt: FROZEN_NOW,
      capacityBand: 'red',
    });
    expect(snap.breakdown.margin_modulated).toBe(false);
  });

  it('threads the band to the engine — a red day lifts the price for a modulated source', () => {
    const base = buildQuoteSnapshot({
      pricingVersionId: VERSION_ID,
      config: dynamicConfig,
      input: calculatorInput,
      computedAt: FROZEN_NOW,
    });
    const red = buildQuoteSnapshot({
      pricingVersionId: VERSION_ID,
      config: dynamicConfig,
      input: calculatorInput,
      computedAt: FROZEN_NOW,
      capacityBand: 'red', // +0.10 margin delta in the fixture
    });
    expect(base.breakdown.margin_modulated).toBe(false);
    expect(red.breakdown.margin_modulated).toBe(true);
    expect(red.breakdown.capacity_band).toBe('red');
    expect(red.total_pence).toBeGreaterThan(base.total_pence);
  });

  it('does not modulate when the source is not in modulation_sources', () => {
    const snap = buildQuoteSnapshot({
      pricingVersionId: VERSION_ID,
      config: dynamicConfig,
      input: { ...baseInput, source: 'b2b_outreach' },
      computedAt: FROZEN_NOW,
      capacityBand: 'red',
    });
    expect(snap.breakdown.margin_modulated).toBe(false);
  });
});

describe('classifyDrift', () => {
  it('returns "match" when the totals are equal', () => {
    expect(classifyDrift(50000, 50000)).toBe('match');
  });

  it('returns "minor_drift" within 1% rounding error', () => {
    expect(classifyDrift(50000, 50100)).toBe('minor_drift');
    expect(classifyDrift(50000, 49500)).toBe('minor_drift');
  });

  it('returns "major_drift" beyond 1%', () => {
    expect(classifyDrift(50000, 60000)).toBe('major_drift');
    expect(classifyDrift(50000, 30000)).toBe('major_drift');
  });

  it('treats zero-vs-nonzero as major_drift', () => {
    expect(classifyDrift(0, 1)).toBe('major_drift');
    expect(classifyDrift(0, 0)).toBe('match');
  });
});
