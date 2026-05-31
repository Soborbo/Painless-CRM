import { formatRemaining, isOverdue } from '@/lib/jobs/sla-remaining';
import { describe, expect, it } from 'vitest';

const MIN = 60_000;
const HOUR = 60 * MIN;

describe('formatRemaining', () => {
  it('renders sub-hour remaining in minutes', () => {
    expect(formatRemaining(12 * MIN, 0)).toBe('12m');
    expect(formatRemaining(MIN, 0)).toBe('1m');
  });

  it('renders exactly-due as 0m', () => {
    expect(formatRemaining(0, 0)).toBe('0m');
  });

  it('renders hours and zero-padded minutes', () => {
    expect(formatRemaining(HOUR + 5 * MIN, 0)).toBe('1h 05m');
    expect(formatRemaining(2 * HOUR + 30 * MIN, 0)).toBe('2h 30m');
  });

  it('prefixes overdue with a minus sign', () => {
    expect(formatRemaining(0, 12 * MIN)).toBe('-12m');
    expect(formatRemaining(0, HOUR + 5 * MIN)).toBe('-1h 05m');
  });

  it('floors partial minutes toward the boundary', () => {
    // 90s remaining -> 1m, not 2m
    expect(formatRemaining(90_000, 0)).toBe('1m');
    // 90s overdue -> -1m
    expect(formatRemaining(0, 90_000)).toBe('-1m');
  });

  it('treats exactly 60 minutes as 1h 00m', () => {
    expect(formatRemaining(HOUR, 0)).toBe('1h 00m');
  });
});

describe('isOverdue', () => {
  it('is true at or past the deadline', () => {
    expect(isOverdue(0, 0)).toBe(true);
    expect(isOverdue(0, 1)).toBe(true);
  });

  it('is false before the deadline', () => {
    expect(isOverdue(MIN, 0)).toBe(false);
  });
});
