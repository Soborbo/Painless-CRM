import { SMOKE_PRICING_CONFIG } from '@/lib/pricing/fixtures';
import { PricingConfigSchema, PublishPricingSchema, QuoteInputSchema } from '@/lib/schemas/pricing';
import { describe, expect, it } from 'vitest';

describe('PricingConfigSchema', () => {
  it('accepts the smoke fixture', () => {
    expect(() => PricingConfigSchema.parse(SMOKE_PRICING_CONFIG)).not.toThrow();
  });

  it('rejects margin matrices that are not 5x3', () => {
    const bad = { ...SMOKE_PRICING_CONFIG, margin_matrix: [[0.1, 0.2, 0.3]] };
    expect(() => PricingConfigSchema.parse(bad)).toThrow();
  });

  it('rejects margin entries outside [0,1]', () => {
    const matrix = SMOKE_PRICING_CONFIG.margin_matrix.map((row) => [...row]);
    const firstRow = matrix[0];
    if (!firstRow) throw new Error('fixture missing first row');
    firstRow[0] = 1.5;
    expect(() =>
      PricingConfigSchema.parse({ ...SMOKE_PRICING_CONFIG, margin_matrix: matrix }),
    ).toThrow();
  });

  it('rejects size category with cubic_ft_max <= cubic_ft_min', () => {
    const bad = {
      ...SMOKE_PRICING_CONFIG,
      size_categories: [
        {
          code: 'broken',
          label: 'Broken',
          cubic_ft_min: 100,
          cubic_ft_max: 100,
          crew_size: 2,
          estimated_hours: 3,
        },
      ],
    };
    expect(() => PricingConfigSchema.parse(bad)).toThrow();
  });

  it('rejects distance bands that are not exactly 3', () => {
    const bad = {
      ...SMOKE_PRICING_CONFIG,
      distance_bands: SMOKE_PRICING_CONFIG.distance_bands.slice(0, 2),
    };
    expect(() => PricingConfigSchema.parse(bad)).toThrow();
  });
});

describe('QuoteInputSchema', () => {
  it('parses minimal input with default complications', () => {
    const parsed = QuoteInputSchema.parse({ size_code: 'two_bed', distance_miles: 12 });
    expect(parsed.complications).toEqual([]);
  });

  it('rejects negative miles', () => {
    expect(() => QuoteInputSchema.parse({ size_code: 'x', distance_miles: -1 })).toThrow();
  });

  it('rejects malformed dates', () => {
    expect(() =>
      QuoteInputSchema.parse({ size_code: 'x', distance_miles: 1, date: 'tomorrow' }),
    ).toThrow();
  });
});

describe('PublishPricingSchema', () => {
  it('wraps a valid config', () => {
    const parsed = PublishPricingSchema.parse({ config: SMOKE_PRICING_CONFIG, notes: 'hi' });
    expect(parsed.config.version_label).toBe(SMOKE_PRICING_CONFIG.version_label);
  });
});
