import { extractPublicBreakdown } from '@/lib/quotes/public-breakdown';
import { describe, expect, it } from 'vitest';

describe('extractPublicBreakdown', () => {
  it('returns nulls when input is null or undefined', () => {
    expect(extractPublicBreakdown(null)).toEqual({
      size_label: null,
      crew_size: null,
      total_estimated_hours: null,
      requires_survey: false,
    });
    expect(extractPublicBreakdown(undefined)).toEqual({
      size_label: null,
      crew_size: null,
      total_estimated_hours: null,
      requires_survey: false,
    });
  });

  it('returns nulls when input is not an object', () => {
    expect(extractPublicBreakdown('not an object')).toEqual({
      size_label: null,
      crew_size: null,
      total_estimated_hours: null,
      requires_survey: false,
    });
  });

  it('extracts customer-friendly fields from a real breakdown', () => {
    const breakdown = {
      size_code: '3-bed',
      size_label: 'Three-bedroom home',
      crew_size: 3,
      estimated_hours: 6,
      hours_added_for_complications: 1,
      complications_bucket: 'minor',
      // Internal fields that must NOT leak:
      margin_pct: 0.42,
      load_unload_split: { load_hours: 4, unload_hours: 2 },
      capacity_band: 'low',
      distance_band_code: 'd-25',
    };
    expect(extractPublicBreakdown(breakdown)).toEqual({
      size_label: 'Three-bedroom home',
      crew_size: 3,
      total_estimated_hours: 7,
      requires_survey: false,
    });
  });

  it('flags requires_survey only when the bucket is survey_required', () => {
    expect(
      extractPublicBreakdown({
        complications_bucket: 'survey_required',
        estimated_hours: 8,
      }).requires_survey,
    ).toBe(true);
    for (const bucket of ['none', 'minor', 'moderate']) {
      expect(extractPublicBreakdown({ complications_bucket: bucket }).requires_survey).toBe(false);
    }
  });

  it('treats unknown bucket strings as not requiring survey', () => {
    expect(extractPublicBreakdown({ complications_bucket: 'wat' }).requires_survey).toBe(false);
  });

  it('handles a breakdown with no added complication hours', () => {
    const out = extractPublicBreakdown({
      size_label: 'Two-bedroom flat',
      crew_size: 2,
      estimated_hours: 4,
    });
    expect(out.total_estimated_hours).toBe(4);
  });

  it('rejects negative or non-finite numeric fields', () => {
    const out = extractPublicBreakdown({
      crew_size: -1,
      estimated_hours: Number.NaN,
      hours_added_for_complications: 2,
    });
    expect(out.crew_size).toBeNull();
    expect(out.total_estimated_hours).toBeNull();
  });

  it('falls back to null size_label for an empty / whitespace string', () => {
    expect(extractPublicBreakdown({ size_label: '   ' }).size_label).toBeNull();
    expect(extractPublicBreakdown({ size_label: '' }).size_label).toBeNull();
  });

  it('does not surface margin_pct or load_unload_split under any key', () => {
    const out = extractPublicBreakdown({
      margin_pct: 0.42,
      load_unload_split: { load_hours: 4, unload_hours: 2 },
      size_label: 'Studio',
    });
    expect(Object.keys(out)).toEqual([
      'size_label',
      'crew_size',
      'total_estimated_hours',
      'requires_survey',
    ]);
  });
});
