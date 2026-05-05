import { AttributionMetaSchema } from '@/lib/jobs/attribution';
import { describe, expect, it } from 'vitest';

describe('AttributionMetaSchema', () => {
  it('parses an empty object as all-nulls/optionals', () => {
    const parsed = AttributionMetaSchema.parse({});
    expect(parsed.utm_source).toBeUndefined();
    expect(parsed.gclid).toBeUndefined();
  });

  it('captures the standard utm + click ids', () => {
    const parsed = AttributionMetaSchema.parse({
      source: 'google',
      campaign: 'spring-bristol',
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'spring-bristol',
      gclid: 'GCL-AAA',
      fbclid: 'FB-BBB',
      landing_page: '/movers/bristol',
    });
    expect(parsed.utm_source).toBe('google');
    expect(parsed.gclid).toBe('GCL-AAA');
    expect(parsed.fbclid).toBe('FB-BBB');
  });

  it('rejects very long click ids', () => {
    expect(() => AttributionMetaSchema.parse({ gclid: 'x'.repeat(201) })).toThrow();
    expect(() => AttributionMetaSchema.parse({ fbclid: 'x'.repeat(201) })).toThrow();
  });

  it('rejects oversized landing_page paths', () => {
    expect(() => AttributionMetaSchema.parse({ landing_page: 'x'.repeat(501) })).toThrow();
  });

  it('accepts null for any field', () => {
    const parsed = AttributionMetaSchema.parse({
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      gclid: null,
      fbclid: null,
      landing_page: null,
    });
    expect(parsed.utm_source).toBeNull();
    expect(parsed.fbclid).toBeNull();
  });
});
