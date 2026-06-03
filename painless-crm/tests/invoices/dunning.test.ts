import { daysOverdue, dunningStage, shouldMarkOverdue } from '@/lib/invoices/dunning';
import { describe, expect, it } from 'vitest';

const DUE = '2026-01-01T00:00:00.000Z';
const plusDays = (n: number) => new Date(Date.parse(DUE) + n * 86_400_000);

describe('daysOverdue', () => {
  it('counts whole days past due, never negative', () => {
    expect(daysOverdue(DUE, plusDays(-5))).toBe(0);
    expect(daysOverdue(DUE, plusDays(0))).toBe(0);
    expect(daysOverdue(DUE, plusDays(3))).toBe(3);
    expect(daysOverdue(DUE, new Date(Date.parse(DUE) + 7 * 86_400_000 + 5000))).toBe(7);
  });
});

describe('dunningStage — highest mark reached (miss-resilient)', () => {
  it('maps each cadence mark', () => {
    expect(dunningStage(3)).toBe('reminder1');
    expect(dunningStage(7)).toBe('reminder2');
    expect(dunningStage(14)).toBe('urgent');
    expect(dunningStage(30)).toBe('admin');
  });

  it('stays silent before the first mark', () => {
    expect(dunningStage(0)).toBe('none');
    expect(dunningStage(2)).toBe('none');
  });

  it('returns the highest mark passed, so a missed cron day still triggers', () => {
    // Audit M4: a boundary skipped (e.g. cron down on day 3/7/14/30) must still
    // fire on the next run. The dunning_log ledger keeps delivery exactly-once.
    expect(dunningStage(4)).toBe('reminder1');
    expect(dunningStage(6)).toBe('reminder1');
    expect(dunningStage(13)).toBe('reminder2');
    expect(dunningStage(15)).toBe('urgent');
    expect(dunningStage(45)).toBe('admin');
  });
});

describe('shouldMarkOverdue', () => {
  it('flips sent/partial invoices once past due, not paid/void/already-overdue', () => {
    expect(shouldMarkOverdue('sent', 1)).toBe(true);
    expect(shouldMarkOverdue('partial', 5)).toBe(true);
    expect(shouldMarkOverdue('sent', 0)).toBe(false);
    expect(shouldMarkOverdue('overdue', 5)).toBe(false);
    expect(shouldMarkOverdue('paid', 5)).toBe(false);
  });
});
