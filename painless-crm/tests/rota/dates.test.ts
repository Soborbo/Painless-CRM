import { addDaysYmd, enumerateDates, isValidYmd, todayYmd } from '@/lib/rota/dates';
import { describe, expect, it } from 'vitest';

describe('isValidYmd', () => {
  it('accepts a well-formed UTC date and rejects junk', () => {
    expect(isValidYmd('2026-06-10')).toBe(true);
    expect(isValidYmd('2026-13-01')).toBe(false);
    expect(isValidYmd('10/06/2026')).toBe(false);
    expect(isValidYmd(undefined)).toBe(false);
  });
});

describe('addDaysYmd', () => {
  it('shifts forward and backward across month boundaries', () => {
    expect(addDaysYmd('2026-06-10', 1)).toBe('2026-06-11');
    expect(addDaysYmd('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDaysYmd('2026-06-01', -1)).toBe('2026-05-31');
  });
});

describe('enumerateDates', () => {
  it('returns count consecutive dates from the start inclusive', () => {
    expect(enumerateDates('2026-06-10', 3)).toEqual(['2026-06-10', '2026-06-11', '2026-06-12']);
  });
});

describe('todayYmd', () => {
  it('extracts the UTC date portion', () => {
    expect(todayYmd(new Date('2026-06-10T23:30:00.000Z'))).toBe('2026-06-10');
  });
});
