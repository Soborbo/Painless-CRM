// CSV serializer for the profit dashboard export.
// Phase 06b §8 + §2b. Gives the accountant the per-job profit grid that
// the dashboard shows on screen, with money in pence (the schema's
// canonical unit) so the figures roundtrip exactly. Margin is the only
// derived float; an empty cell means revenue was zero (undefined margin).
//
// Escaping follows RFC 4180 via the shared `csvField` helper.

import { csvField } from '@/lib/exports/jobs-csv';
import { computeProfit } from '@/lib/jobs/profit';
import type { ProfitDashboardJob } from '@/lib/jobs/profit-dashboard';
import { customerDisplayName } from '@/lib/utils/format';

export const PROFIT_CSV_HEADER = [
  'job_number',
  'customer',
  'completed_at',
  'acquisition_source',
  'review_status',
  'revenue_pence',
  'cost_pence',
  'profit_pence',
  'margin_pct',
] as const;

function profitToRow(job: ProfitDashboardJob): string {
  const r = computeProfit({
    revenuePence: job.revenuePence,
    crewPence: job.actual_crew_cost_pence ?? 0,
    vanPence: job.actual_van_cost_pence ?? 0,
    passthroughPence: job.passthrough_costs_pence ?? 0,
  });
  return [
    csvField(job.job_number),
    csvField(job.customer ? customerDisplayName(job.customer) : ''),
    csvField(job.completed_at ?? ''),
    csvField(job.acquisition_source ?? ''),
    csvField(job.profit_review_status),
    csvField(job.revenuePence),
    csvField(r.totalCostPence),
    csvField(r.profitPence),
    csvField(r.marginPct === null ? '' : r.marginPct.toFixed(1)),
  ].join(',');
}

export function serializeProfitToCsv(jobs: readonly ProfitDashboardJob[]): string {
  const header = PROFIT_CSV_HEADER.join(',');
  const body = jobs.map(profitToRow).join('\r\n');
  if (body.length === 0) return `${header}\r\n`;
  return `${header}\r\n${body}\r\n`;
}

export function profitExportFilename(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `profit-${yyyy}-${mm}-${dd}.csv`;
}
