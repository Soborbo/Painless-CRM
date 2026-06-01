import {
  type AssignmentSlot,
  findWorkerConflict,
  rangesOverlap,
  timeToMinutes,
} from '@/lib/rota/conflicts';
import { describe, expect, it } from 'vitest';

describe('timeToMinutes', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('09:30:00')).toBe(570);
    expect(timeToMinutes('00:00')).toBe(0);
  });
  it('is null for empty or invalid', () => {
    expect(timeToMinutes(null)).toBeNull();
    expect(timeToMinutes('')).toBeNull();
    expect(timeToMinutes('25:00')).toBeNull();
    expect(timeToMinutes('nope')).toBeNull();
  });
});

describe('rangesOverlap', () => {
  it('detects overlapping windows', () => {
    expect(rangesOverlap('09:00', '12:00', '11:00', '13:00')).toBe(true);
  });
  it('treats touching edges as non-overlapping', () => {
    expect(rangesOverlap('09:00', '12:00', '12:00', '14:00')).toBe(false);
  });
  it('treats a missing time as all-day (always overlaps)', () => {
    expect(rangesOverlap(null, null, '09:00', '10:00')).toBe(true);
    expect(rangesOverlap('09:00', '10:00', null, null)).toBe(true);
  });
});

function slot(o: Partial<AssignmentSlot>): AssignmentSlot {
  return {
    job_id: 'jA',
    worker_id: 'w1',
    date: '2026-06-10',
    scheduled_start: null,
    scheduled_end: null,
    ...o,
  };
}

describe('findWorkerConflict', () => {
  it('flags a same-worker, same-date, different-job overlap', () => {
    const candidate = slot({ job_id: 'jB', scheduled_start: '09:00', scheduled_end: '12:00' });
    const existing = [slot({ job_id: 'jA', scheduled_start: '11:00', scheduled_end: '13:00' })];
    expect(findWorkerConflict(candidate, existing)?.job_id).toBe('jA');
  });

  it('ignores a different worker', () => {
    const candidate = slot({ job_id: 'jB', worker_id: 'w2' });
    expect(findWorkerConflict(candidate, [slot({ job_id: 'jA' })])).toBeNull();
  });

  it('ignores a different date', () => {
    const candidate = slot({ job_id: 'jB', date: '2026-06-11' });
    expect(findWorkerConflict(candidate, [slot({ job_id: 'jA' })])).toBeNull();
  });

  it('does not conflict with the same job', () => {
    const candidate = slot({ job_id: 'jA', scheduled_start: '09:00', scheduled_end: '10:00' });
    expect(findWorkerConflict(candidate, [slot({ job_id: 'jA' })])).toBeNull();
  });

  it('flags an all-day clash when times are absent', () => {
    const candidate = slot({ job_id: 'jB' });
    expect(findWorkerConflict(candidate, [slot({ job_id: 'jA' })])?.job_id).toBe('jA');
  });
});
