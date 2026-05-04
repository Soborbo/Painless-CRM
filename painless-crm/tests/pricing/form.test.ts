import { parseSimulationForm } from '@/lib/pricing/form';
import { describe, expect, it } from 'vitest';

function buildForm(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe('parseSimulationForm', () => {
  it('coerces a minimal form into a QuoteInput', () => {
    const result = parseSimulationForm(
      buildForm([
        ['size_code', 'two_bed'],
        ['distance_miles', '12'],
      ]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.size_code).toBe('two_bed');
      expect(result.input.distance_miles).toBe(12);
      expect(result.input.complications).toEqual([]);
      expect(result.input.source).toBeUndefined();
    }
  });

  it('flattens repeated complications entries into one array', () => {
    const result = parseSimulationForm(
      buildForm([
        ['size_code', 'two_bed'],
        ['distance_miles', '12'],
        ['complications', 'narrow_access'],
        ['complications', 'long_carry'],
      ]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.complications).toEqual(['narrow_access', 'long_carry']);
    }
  });

  it('also accepts comma-separated complications in a single entry', () => {
    const result = parseSimulationForm(
      buildForm([
        ['size_code', 'two_bed'],
        ['distance_miles', '12'],
        ['complications', 'narrow_access, long_carry , piano'],
      ]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.complications).toEqual(['narrow_access', 'long_carry', 'piano']);
    }
  });

  it('drops empty source rather than failing the email-style url check', () => {
    const result = parseSimulationForm(
      buildForm([
        ['size_code', 'two_bed'],
        ['distance_miles', '12'],
        ['source', ''],
      ]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.source).toBeUndefined();
  });

  it('reports an error when distance is not a number', () => {
    const result = parseSimulationForm(
      buildForm([
        ['size_code', 'two_bed'],
        ['distance_miles', 'soon'],
      ]),
    );
    expect(result.ok).toBe(false);
  });

  it('reports an error when size_code is missing', () => {
    const result = parseSimulationForm(buildForm([['distance_miles', '12']]));
    expect(result.ok).toBe(false);
  });
});
