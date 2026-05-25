import {
  REQUOTE_ELIGIBLE_STAGES,
  buildRequoteInsert,
  isRequoteEligibleStage,
} from '@/lib/jobs/requote';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-05-25T10:00:00Z');
const SOURCE = {
  id: 'job-123',
  company_id: 'company-1',
  customer_id: 'cust-1',
  stage: 'paid',
  acquisition_source: 'google_ads',
  estimated_hours: 6,
  estimated_cubic_ft: 540,
  estimated_distance_miles: 22,
} as const;

const OVERRIDES = {
  moveDateIso: '2026-07-04T09:00:00.000Z',
  assignedToId: 'rep-1',
  notes: 'Repeat customer — same crew',
};

describe('isRequoteEligibleStage', () => {
  it('accepts every terminal stage in the explicit list', () => {
    for (const stage of REQUOTE_ELIGIBLE_STAGES) {
      expect(isRequoteEligibleStage(stage)).toBe(true);
    }
  });

  it('rejects mid-pipeline stages', () => {
    expect(isRequoteEligibleStage('lead')).toBe(false);
    expect(isRequoteEligibleStage('confirmed')).toBe(false);
    expect(isRequoteEligibleStage('in_progress')).toBe(false);
  });

  it('rejects garbage stages', () => {
    expect(isRequoteEligibleStage('unknown')).toBe(false);
    expect(isRequoteEligibleStage('')).toBe(false);
  });
});

describe('buildRequoteInsert', () => {
  it('produces a lead-stage insert linked back to the source via parent_job_id', () => {
    const insert = buildRequoteInsert({
      source: SOURCE,
      jobNumber: 'J2026-00010',
      overrides: OVERRIDES,
      actorId: 'user-1',
      now: NOW,
    });

    expect(insert).toEqual({
      company_id: 'company-1',
      job_number: 'J2026-00010',
      customer_id: 'cust-1',
      parent_job_id: 'job-123',
      stage: 'lead',
      acquisition_source: 'google_ads',
      assigned_to_id: 'rep-1',
      move_date: '2026-07-04T09:00:00.000Z',
      enquiry_at: '2026-05-25T10:00:00.000Z',
      first_response_due_at: '2026-05-25T10:10:00.000Z',
      estimated_hours: 6,
      estimated_cubic_ft: 540,
      estimated_distance_miles: 22,
      notes: 'Repeat customer — same crew',
      created_by_id: 'user-1',
      updated_by_id: 'user-1',
    });
  });

  it('falls back to referral when the source job has no acquisition source', () => {
    const insert = buildRequoteInsert({
      source: { ...SOURCE, acquisition_source: null },
      jobNumber: 'J2026-00011',
      overrides: { ...OVERRIDES, assignedToId: null, notes: null },
      actorId: 'user-1',
      now: NOW,
    });
    expect(insert.acquisition_source).toBe('referral');
    expect(insert.first_response_due_at).toBe('2026-05-25T10:30:00.000Z');
    expect(insert.assigned_to_id).toBeNull();
    expect(insert.notes).toBeNull();
  });

  it('carries the estimating quantities even when they are zero or null', () => {
    const insert = buildRequoteInsert({
      source: {
        ...SOURCE,
        estimated_hours: null,
        estimated_cubic_ft: 0,
        estimated_distance_miles: null,
      },
      jobNumber: 'J2026-00012',
      overrides: OVERRIDES,
      actorId: 'user-1',
      now: NOW,
    });
    expect(insert.estimated_hours).toBeNull();
    expect(insert.estimated_cubic_ft).toBe(0);
    expect(insert.estimated_distance_miles).toBeNull();
  });

  it('refuses non-terminal source stages', () => {
    expect(() =>
      buildRequoteInsert({
        source: { ...SOURCE, stage: 'quoted' },
        jobNumber: 'J2026-00013',
        overrides: OVERRIDES,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(/Cannot requote/);
  });
});
