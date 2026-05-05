import {
  DEFAULT_SLA_MINUTES,
  computeFirstResponseDueAt,
  slaMinutesForSource,
} from '@/lib/jobs/sla-deadline';
import { describe, expect, it } from 'vitest';

const ENQUIRY = '2026-05-04T10:00:00Z';

describe('slaMinutesForSource', () => {
  it('returns the configured minutes for known sources', () => {
    expect(slaMinutesForSource('google_ads')).toBe(10);
    expect(slaMinutesForSource('phone')).toBe(5);
    expect(slaMinutesForSource('referral')).toBe(30);
  });

  it('falls back to the default for unknown sources', () => {
    expect(slaMinutesForSource('something_else')).toBe(DEFAULT_SLA_MINUTES);
    expect(slaMinutesForSource(null)).toBe(DEFAULT_SLA_MINUTES);
    expect(slaMinutesForSource(undefined)).toBe(DEFAULT_SLA_MINUTES);
    expect(slaMinutesForSource('')).toBe(DEFAULT_SLA_MINUTES);
  });
});

describe('computeFirstResponseDueAt', () => {
  it('shifts the enquiry timestamp by the per-source SLA minutes', () => {
    expect(computeFirstResponseDueAt(ENQUIRY, 'phone')).toBe('2026-05-04T10:05:00.000Z');
    expect(computeFirstResponseDueAt(ENQUIRY, 'google_ads')).toBe('2026-05-04T10:10:00.000Z');
    expect(computeFirstResponseDueAt(ENQUIRY, 'website')).toBe('2026-05-04T10:15:00.000Z');
    expect(computeFirstResponseDueAt(ENQUIRY, 'referral')).toBe('2026-05-04T10:30:00.000Z');
  });

  it('uses the default for an unknown source', () => {
    expect(computeFirstResponseDueAt(ENQUIRY, 'mystery')).toBe('2026-05-04T10:15:00.000Z');
    expect(computeFirstResponseDueAt(ENQUIRY, null)).toBe('2026-05-04T10:15:00.000Z');
  });

  it('accepts a Date instance', () => {
    expect(computeFirstResponseDueAt(new Date(ENQUIRY), 'phone')).toBe('2026-05-04T10:05:00.000Z');
  });

  it('throws on an invalid enquiry timestamp', () => {
    expect(() => computeFirstResponseDueAt('not-a-date', 'phone')).toThrow();
  });
});
