// Phase 14 — financial report: revenue summary + accounts-receivable aging.
// Pure aggregation; the Supabase reads live in lib/queries/reports.ts.
//
// Revenue summary works on a cohort of invoices *issued* within a date range.
// AR aging is a point-in-time snapshot of everything still owed *as of now*,
// independent of the range — money owed doesn't belong to a reporting window.
//
// Excluded everywhere: drafts (not yet issued) and voids (cancelled). A
// 'paid' invoice has zero outstanding, so it never lands in an aging bucket.

export interface FinancialInvoiceRow {
  status: string | null;
  total_pence: number | null;
  amount_paid_pence: number | null;
  amount_outstanding_pence: number | null;
  issued_at: string | null;
  due_at: string | null;
}

/** Statuses that represent real, issued receivables. */
function isReceivable(status: string | null): boolean {
  return status !== 'void' && status !== 'draft';
}

export interface RevenueSummary {
  /** Invoices issued in the period (excluding drafts/voids). */
  invoiceCount: number;
  /** Sum of total_pence across the cohort. */
  invoicedPence: number;
  /** Sum of amount_paid_pence — money actually collected against the cohort. */
  collectedPence: number;
  /** Sum of amount_outstanding_pence — still owed from the cohort. */
  outstandingPence: number;
  /** collected / invoiced, 0–100, or null when nothing was invoiced. */
  collectionRatePct: number | null;
}

export function buildRevenueSummary(rows: readonly FinancialInvoiceRow[]): RevenueSummary {
  let invoiceCount = 0;
  let invoicedPence = 0;
  let collectedPence = 0;
  let outstandingPence = 0;
  for (const r of rows) {
    if (!isReceivable(r.status)) continue;
    invoiceCount += 1;
    invoicedPence += r.total_pence ?? 0;
    collectedPence += r.amount_paid_pence ?? 0;
    outstandingPence += r.amount_outstanding_pence ?? 0;
  }
  return {
    invoiceCount,
    invoicedPence,
    collectedPence,
    outstandingPence,
    collectionRatePct: invoicedPence > 0 ? (collectedPence / invoicedPence) * 100 : null,
  };
}

export const AGING_BUCKETS = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'] as const;
export type AgingBucketKey = (typeof AGING_BUCKETS)[number];

export interface AgingBucket {
  key: AgingBucketKey;
  count: number;
  outstandingPence: number;
}

export interface ArAging {
  buckets: AgingBucket[];
  totalCount: number;
  totalOutstandingPence: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function bucketFor(daysPastDue: number): AgingBucketKey {
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 30) return 'd1_30';
  if (daysPastDue <= 60) return 'd31_60';
  if (daysPastDue <= 90) return 'd61_90';
  return 'd90_plus';
}

/**
 * Buckets every still-outstanding invoice by how far past its due date it is,
 * as of `nowIso`. A null due date (or no outstanding balance) counts as
 * current. Drafts and voids are ignored.
 */
export function buildArAging(rows: readonly FinancialInvoiceRow[], nowIso: string): ArAging {
  const now = new Date(nowIso).getTime();
  const totals = new Map<AgingBucketKey, AgingBucket>(
    AGING_BUCKETS.map((key) => [key, { key, count: 0, outstandingPence: 0 }]),
  );
  let totalCount = 0;
  let totalOutstandingPence = 0;

  for (const r of rows) {
    if (!isReceivable(r.status)) continue;
    const outstanding = r.amount_outstanding_pence ?? 0;
    if (outstanding <= 0) continue;
    const daysPastDue = r.due_at ? Math.floor((now - new Date(r.due_at).getTime()) / DAY_MS) : 0;
    const bucket = totals.get(bucketFor(daysPastDue));
    if (!bucket) continue;
    bucket.count += 1;
    bucket.outstandingPence += outstanding;
    totalCount += 1;
    totalOutstandingPence += outstanding;
  }

  return {
    buckets: AGING_BUCKETS.map((key) => totals.get(key)!),
    totalCount,
    totalOutstandingPence,
  };
}
