import {
  FINANCIAL_CSV_HEADER,
  SOURCES_CSV_HEADER,
  STORAGE_CSV_HEADER,
  reportExportFilename,
  serializeArAgingToCsv,
  serializeSourcesToCsv,
  serializeStorageToCsv,
} from '@/lib/exports/reports-csv';
import { buildArAging } from '@/lib/reports/financial';
import { buildStorageReport } from '@/lib/reports/storage';
import { describe, expect, it } from 'vitest';

describe('serializeSourcesToCsv', () => {
  it('emits the header and one row per source with pence + 1dp percentages', () => {
    const csv = serializeSourcesToCsv([
      {
        source: 'google_ads',
        leads: 4,
        quoted: 2,
        won: 1,
        revenuePence: 100_00,
        conversionPct: 25,
        avgJobValuePence: 100_00,
        wonCustomers: 1,
        repeatRatePct: 0,
        ltvPence: 100_00,
        score: 25,
      },
    ]);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe(SOURCES_CSV_HEADER.join(','));
    expect(lines[1]).toBe('google_ads,4,2,1,25.0,10000,10000,0.0,10000,25');
  });

  it('leaves null avg value / ltv as empty cells', () => {
    const csv = serializeSourcesToCsv([
      {
        source: 'referral',
        leads: 1,
        quoted: 0,
        won: 0,
        revenuePence: 0,
        conversionPct: 0,
        avgJobValuePence: null,
        wonCustomers: 0,
        repeatRatePct: 0,
        ltvPence: null,
        score: 0,
      },
    ]);
    expect(csv.trimEnd().split('\r\n')[1]).toBe('referral,1,0,0,0.0,0,,0.0,,0');
  });

  it('returns header-only when there are no sources', () => {
    expect(serializeSourcesToCsv([])).toBe(`${SOURCES_CSV_HEADER.join(',')}\r\n`);
  });
});

describe('serializeArAgingToCsv', () => {
  it('emits a row per bucket with share and a total trailer', () => {
    const aging = buildArAging(
      [
        { status: 'sent', total_pence: 0, amount_paid_pence: 0, amount_outstanding_pence: 100_00, issued_at: null, due_at: '2026-07-01T00:00:00Z' },
        { status: 'sent', total_pence: 0, amount_paid_pence: 0, amount_outstanding_pence: 300_00, issued_at: null, due_at: '2026-01-01T00:00:00Z' },
      ],
      '2026-06-02T00:00:00Z',
    );
    const csv = serializeArAgingToCsv(aging);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe(FINANCIAL_CSV_HEADER.join(','));
    expect(lines).toContain('current,1,10000,25.0');
    expect(lines).toContain('d90_plus,1,30000,75.0');
    expect(lines.at(-1)).toBe('total,2,40000,');
  });
});

describe('serializeStorageToCsv', () => {
  it('emits a metric/value grid in pence', () => {
    const report = buildStorageReport(
      [{ status: 'active', monthly_rate_pence: 100_00, start_date: '2025-01-01', end_date: null }],
      { startIso: '2026-06-01T00:00:00Z', endIso: '2026-07-01T00:00:00Z' },
    );
    const csv = serializeStorageToCsv(report);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe(STORAGE_CSV_HEADER.join(','));
    expect(lines).toContain('mrr_pence,10000');
    expect(lines).toContain('active_rentals,1');
    // one active rental, none churned → 0.0% churn over a base of 1
    expect(lines).toContain('churn_rate_pct,0.0');
  });

  it('leaves churn rate empty when there is no base (no active, none churned)', () => {
    const report = buildStorageReport([], {
      startIso: '2026-06-01T00:00:00Z',
      endIso: '2026-07-01T00:00:00Z',
    });
    expect(serializeStorageToCsv(report).trimEnd().split('\r\n')).toContain('churn_rate_pct,');
  });
});

describe('reportExportFilename', () => {
  it('stamps the name with a UTC date', () => {
    expect(reportExportFilename('storage', new Date('2026-06-02T12:00:00Z'))).toBe(
      'report-storage-2026-06-02.csv',
    );
  });
});
