import { bucketCashTotals, last24hWindow, todayWindow } from '@/lib/queries/home-snapshot';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-05-25T10:30:00Z');

describe('last24hWindow', () => {
  it('returns the 24 hours leading up to now', () => {
    const window = last24hWindow(NOW);
    expect(window.endIso).toBe('2026-05-25T10:30:00.000Z');
    expect(window.startIso).toBe('2026-05-24T10:30:00.000Z');
  });
});

describe('todayWindow', () => {
  it('returns midnight-to-midnight in the local timezone', () => {
    const window = todayWindow(NOW);
    // start <= now < end, end is exactly start + 1 day
    expect(new Date(window.startIso).getTime()).toBeLessThanOrEqual(NOW.getTime());
    expect(new Date(window.endIso).getTime()).toBeGreaterThan(NOW.getTime());
    const dayMs = 24 * 60 * 60 * 1000;
    expect(new Date(window.endIso).getTime() - new Date(window.startIso).getTime()).toBe(dayMs);
  });
});

describe('bucketCashTotals', () => {
  it('returns all zeros when there are no rows', () => {
    expect(bucketCashTotals([], NOW)).toEqual({
      outstandingPence: 0,
      overduePence: 0,
      outstandingCount: 0,
      overdueCount: 0,
    });
  });

  it('ignores rows with no outstanding balance', () => {
    const rows = [
      { amount_outstanding_pence: 0, due_at: '2026-01-01T00:00:00Z' },
      { amount_outstanding_pence: null, due_at: '2026-01-01T00:00:00Z' },
    ];
    expect(bucketCashTotals(rows, NOW)).toEqual({
      outstandingPence: 0,
      overduePence: 0,
      outstandingCount: 0,
      overdueCount: 0,
    });
  });

  it('counts past-due invoices as both outstanding and overdue', () => {
    const rows = [
      { amount_outstanding_pence: 12_000, due_at: '2026-05-20T00:00:00Z' },
      { amount_outstanding_pence: 5_000, due_at: '2026-05-21T00:00:00Z' },
    ];
    const totals = bucketCashTotals(rows, NOW);
    expect(totals).toEqual({
      outstandingPence: 17_000,
      overduePence: 17_000,
      outstandingCount: 2,
      overdueCount: 2,
    });
  });

  it('counts future-due invoices as outstanding only', () => {
    const rows = [{ amount_outstanding_pence: 12_000, due_at: '2026-06-30T00:00:00Z' }];
    const totals = bucketCashTotals(rows, NOW);
    expect(totals.outstandingPence).toBe(12_000);
    expect(totals.overduePence).toBe(0);
    expect(totals.outstandingCount).toBe(1);
    expect(totals.overdueCount).toBe(0);
  });

  it('counts no-due-date invoices as outstanding only (never overdue)', () => {
    const rows = [{ amount_outstanding_pence: 4_500, due_at: null }];
    const totals = bucketCashTotals(rows, NOW);
    expect(totals.outstandingPence).toBe(4_500);
    expect(totals.overduePence).toBe(0);
    expect(totals.overdueCount).toBe(0);
  });

  it('mixes overdue and on-track invoices correctly', () => {
    const rows = [
      { amount_outstanding_pence: 12_000, due_at: '2026-05-20T00:00:00Z' },
      { amount_outstanding_pence: 5_000, due_at: '2026-06-15T00:00:00Z' },
      { amount_outstanding_pence: 0, due_at: '2026-05-01T00:00:00Z' },
    ];
    const totals = bucketCashTotals(rows, NOW);
    expect(totals).toEqual({
      outstandingPence: 17_000,
      overduePence: 12_000,
      outstandingCount: 2,
      overdueCount: 1,
    });
  });
});
