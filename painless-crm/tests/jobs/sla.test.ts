import { computeSLAStatus } from '@/lib/jobs/sla';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-05-04T12:00:00Z');

describe('computeSLAStatus', () => {
  it('returns "cleared" when first_response_at is set', () => {
    expect(
      computeSLAStatus({
        firstResponseDueAt: '2026-05-04T13:00:00Z',
        firstResponseAt: '2026-05-04T11:00:00Z',
        enquiryAt: '2026-05-04T11:00:00Z',
        now: NOW,
      }),
    ).toBe('cleared');
  });

  it('returns "not_applicable" when no due timestamp', () => {
    expect(
      computeSLAStatus({
        firstResponseDueAt: null,
        firstResponseAt: null,
        enquiryAt: '2026-05-04T11:00:00Z',
        now: NOW,
      }),
    ).toBe('not_applicable');
  });

  it('returns "breach" when due is in the past and no first response', () => {
    expect(
      computeSLAStatus({
        firstResponseDueAt: '2026-05-04T10:00:00Z',
        firstResponseAt: null,
        enquiryAt: '2026-05-04T08:00:00Z',
        now: NOW,
      }),
    ).toBe('breach');
  });

  it('returns "warn" when remaining time is within the warn fraction', () => {
    expect(
      computeSLAStatus({
        firstResponseDueAt: '2026-05-04T12:30:00Z',
        firstResponseAt: null,
        enquiryAt: '2026-05-04T08:00:00Z',
        now: NOW,
      }),
    ).toBe('warn');
  });

  it('returns "on_track" when ample time remains', () => {
    expect(
      computeSLAStatus({
        firstResponseDueAt: '2026-05-04T20:00:00Z',
        firstResponseAt: null,
        enquiryAt: '2026-05-04T11:00:00Z',
        now: NOW,
      }),
    ).toBe('on_track');
  });

  it('returns "not_applicable" for malformed due', () => {
    expect(
      computeSLAStatus({
        firstResponseDueAt: 'banana',
        firstResponseAt: null,
        enquiryAt: '2026-05-04T11:00:00Z',
        now: NOW,
      }),
    ).toBe('not_applicable');
  });

  it('without enquiryAt, falls through to on_track / breach without warn ramp', () => {
    expect(
      computeSLAStatus({
        firstResponseDueAt: '2026-05-04T13:00:00Z',
        firstResponseAt: null,
        enquiryAt: null,
        now: NOW,
      }),
    ).toBe('on_track');
  });
});
