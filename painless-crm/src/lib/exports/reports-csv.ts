// CSV serializers for the Phase 14 report exports.
// Each report streams its primary tabular data as an accountant-friendly grid;
// money stays in pence (the schema's canonical unit) so figures roundtrip
// exactly, and percentages are emitted to one decimal place. Escaping follows
// RFC 4180 via the shared `csvField` helper.

import { csvField } from '@/lib/exports/jobs-csv';
import type { SourceAttribution } from '@/lib/reports/attribution';
import type { ArAging } from '@/lib/reports/financial';
import type { StorageReport } from '@/lib/reports/storage';

function pct1(value: number | null): string {
  return value === null ? '' : value.toFixed(1);
}

function withTrailer(header: string, rows: readonly string[]): string {
  if (rows.length === 0) return `${header}\r\n`;
  return `${header}\r\n${rows.join('\r\n')}\r\n`;
}

function dateStamp(now: Date): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function reportExportFilename(name: string, now: Date = new Date()): string {
  return `report-${name}-${dateStamp(now)}.csv`;
}

// --- Source attribution -----------------------------------------------------

export const SOURCES_CSV_HEADER = [
  'source',
  'leads',
  'quoted',
  'won',
  'conversion_pct',
  'revenue_pence',
  'avg_value_pence',
  'repeat_pct',
  'ltv_pence',
  'score',
] as const;

export function serializeSourcesToCsv(sources: readonly SourceAttribution[]): string {
  const rows = sources.map((s) =>
    [
      csvField(s.source),
      csvField(s.leads),
      csvField(s.quoted),
      csvField(s.won),
      csvField(pct1(s.conversionPct)),
      csvField(s.revenuePence),
      csvField(s.avgJobValuePence ?? ''),
      csvField(pct1(s.repeatRatePct)),
      csvField(s.ltvPence ?? ''),
      csvField(s.score),
    ].join(','),
  );
  return withTrailer(SOURCES_CSV_HEADER.join(','), rows);
}

// --- Financial: AR aging ----------------------------------------------------

export const FINANCIAL_CSV_HEADER = [
  'bucket',
  'invoices',
  'outstanding_pence',
  'share_pct',
] as const;

export function serializeArAgingToCsv(aging: ArAging): string {
  const total = aging.totalOutstandingPence;
  const rows = aging.buckets.map((b) =>
    [
      csvField(b.key),
      csvField(b.count),
      csvField(b.outstandingPence),
      csvField(pct1(total > 0 ? (b.outstandingPence / total) * 100 : null)),
    ].join(','),
  );
  rows.push(
    [csvField('total'), csvField(aging.totalCount), csvField(total), csvField('')].join(','),
  );
  return withTrailer(FINANCIAL_CSV_HEADER.join(','), rows);
}

// --- Storage performance ----------------------------------------------------

export const STORAGE_CSV_HEADER = ['metric', 'value'] as const;

// Storage is KPI-shaped rather than row-shaped, so the CSV is a metric/value
// grid — pence metrics keep their pence value, counts and rates are plain.
export function serializeStorageToCsv(report: StorageReport): string {
  const rows: Array<[string, number | string | null]> = [
    ['mrr_pence', report.mrrPence],
    ['active_rentals', report.activeRentals],
    ['pending_rentals', report.pendingRentals],
    ['pending_mrr_pence', report.pendingMrrPence],
    ['avg_rate_pence', report.avgRatePence],
    ['new_in_period', report.newInPeriod],
    ['new_mrr_pence', report.newMrrPence],
    ['churned_in_period', report.churnedInPeriod],
    ['churned_mrr_pence', report.churnedMrrPence],
    ['net_mrr_change_pence', report.netMrrChangePence],
    ['churn_rate_pct', pct1(report.churnRatePct) || null],
  ];
  const body = rows.map(([metric, value]) => [csvField(metric), csvField(value ?? '')].join(','));
  return withTrailer(STORAGE_CSV_HEADER.join(','), body);
}
