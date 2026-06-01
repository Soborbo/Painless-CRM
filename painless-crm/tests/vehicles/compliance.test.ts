import { complianceStatus, daysUntilDue, reminderThresholdFor } from '@/lib/vehicles/compliance';
import { describe, expect, it } from 'vitest';

const TODAY = new Date('2026-06-01T09:00:00.000Z');

describe('daysUntilDue', () => {
  it('is null for missing or invalid dates', () => {
    expect(daysUntilDue(null, TODAY)).toBeNull();
    expect(daysUntilDue('', TODAY)).toBeNull();
    expect(daysUntilDue('not-a-date', TODAY)).toBeNull();
  });
  it('counts whole days ahead in UTC, ignoring the time of day', () => {
    expect(daysUntilDue('2026-06-01', TODAY)).toBe(0);
    expect(daysUntilDue('2026-06-02', TODAY)).toBe(1);
    expect(daysUntilDue('2026-07-01', TODAY)).toBe(30);
  });
  it('is negative once the date has passed', () => {
    expect(daysUntilDue('2026-05-30', TODAY)).toBe(-2);
  });
});

describe('complianceStatus', () => {
  it('reports none when no date is set', () => {
    expect(complianceStatus(null, TODAY)).toEqual({ state: 'none', daysUntil: null });
  });
  it('reports expired for past dates', () => {
    expect(complianceStatus('2026-05-31', TODAY).state).toBe('expired');
  });
  it('reports due-soon within 30 days inclusive', () => {
    expect(complianceStatus('2026-06-01', TODAY).state).toBe('due-soon');
    expect(complianceStatus('2026-07-01', TODAY).state).toBe('due-soon');
  });
  it('reports ok beyond 30 days', () => {
    expect(complianceStatus('2026-07-02', TODAY).state).toBe('ok');
  });
});

describe('reminderThresholdFor', () => {
  it('fires only on the exact 30/14/7-day marks', () => {
    expect(reminderThresholdFor('2026-07-01', TODAY)).toBe(30); // 30 days out
    expect(reminderThresholdFor('2026-06-15', TODAY)).toBe(14);
    expect(reminderThresholdFor('2026-06-08', TODAY)).toBe(7);
  });
  it('is null between marks and after expiry', () => {
    expect(reminderThresholdFor('2026-06-20', TODAY)).toBeNull();
    expect(reminderThresholdFor('2026-05-30', TODAY)).toBeNull();
    expect(reminderThresholdFor(null, TODAY)).toBeNull();
  });
});
