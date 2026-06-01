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

describe('dunningStage — fires only on exact marks', () => {
  it('maps the cadence and stays silent between marks', () => {
    expect(dunningStage(3)).toBe('reminder1');
    expect(dunningStage(7)).toBe('reminder2');
    expect(dunningStage(14)).toBe('urgent');
    expect(dunningStage(30)).toBe('admin');
    expect(dunningStage(4)).toBe('none');
    expect(dunningStage(15)).toBe('none');
    expect(dunningStage(0)).toBe('none');
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
