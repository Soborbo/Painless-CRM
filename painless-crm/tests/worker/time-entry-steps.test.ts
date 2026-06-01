import {
  TIME_ENTRY_STEPS,
  buildStepStates,
  isTimeEntryStep,
  nextStep,
} from '@/lib/worker/time-entry-steps';
import { describe, expect, it } from 'vitest';

describe('isTimeEntryStep', () => {
  it('accepts the progression steps, rejects clock_in and junk', () => {
    expect(isTimeEntryStep('load_start')).toBe(true);
    expect(isTimeEntryStep('clock_out')).toBe(true);
    expect(isTimeEntryStep('clock_in')).toBe(false);
    expect(isTimeEntryStep(null)).toBe(false);
  });
});

describe('buildStepStates', () => {
  it('returns all steps in order, unrecorded when empty', () => {
    const states = buildStepStates([]);
    expect(states.map((s) => s.type)).toEqual([...TIME_ENTRY_STEPS]);
    expect(states.every((s) => s.recordedAt === null)).toBe(true);
  });

  it('marks recorded steps with their earliest timestamp', () => {
    const states = buildStepStates([
      { type: 'load_start', occurred_at: '2026-06-10T09:30:00.000Z' },
      { type: 'load_start', occurred_at: '2026-06-10T09:00:00.000Z' }, // earlier wins
      { type: 'load_end', occurred_at: '2026-06-10T10:00:00.000Z' },
    ]);
    const byType = Object.fromEntries(states.map((s) => [s.type, s.recordedAt]));
    expect(byType.load_start).toBe('2026-06-10T09:00:00.000Z');
    expect(byType.load_end).toBe('2026-06-10T10:00:00.000Z');
    expect(byType.unload_start).toBeNull();
  });

  it('ignores unknown / null types', () => {
    const states = buildStepStates([
      { type: 'clock_in', occurred_at: '2026-06-10T08:00:00.000Z' },
      { type: null, occurred_at: '2026-06-10T08:05:00.000Z' },
    ]);
    expect(states.every((s) => s.recordedAt === null)).toBe(true);
  });
});

describe('nextStep', () => {
  it('is the first unrecorded step', () => {
    const states = buildStepStates([
      { type: 'load_start', occurred_at: '2026-06-10T09:00:00.000Z' },
    ]);
    expect(nextStep(states)).toBe('load_end');
  });
  it('is null once every step is recorded', () => {
    const all = TIME_ENTRY_STEPS.map((type) => ({ type, occurred_at: '2026-06-10T09:00:00.000Z' }));
    expect(nextStep(buildStepStates(all))).toBeNull();
  });
});
