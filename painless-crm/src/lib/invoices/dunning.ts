// Phase 12 §9 — dunning cadence for overdue invoices. Pure + date-injectable.
//
//   T+3  → reminder1   (friendly)
//   T+7  → reminder2    (please reply)
//   T+14 → urgent
//   T+30 → admin        (escalate internally; auto-pause is configurable, later)
//
// `dunningStage` returns the HIGHEST cadence mark reached so far (audit M4): a
// missed cron day no longer skips a stage permanently. Exactly-once delivery is
// enforced by the `dunning_log(invoice_id, stage)` ledger in the sweep — the
// stage logic itself is no longer responsible for "once".

export type DunningStage = 'none' | 'reminder1' | 'reminder2' | 'urgent' | 'admin';

const DAY_MS = 24 * 60 * 60 * 1000;

// Descending so the first match is the most-severe stage reached.
const STAGE_MARKS: ReadonlyArray<{ readonly at: number; readonly stage: DunningStage }> = [
  { at: 30, stage: 'admin' },
  { at: 14, stage: 'urgent' },
  { at: 7, stage: 'reminder2' },
  { at: 3, stage: 'reminder1' },
];

export function daysOverdue(dueAt: string, now: Date): number {
  const diff = now.getTime() - new Date(dueAt).getTime();
  return diff <= 0 ? 0 : Math.floor(diff / DAY_MS);
}

export function dunningStage(days: number): DunningStage {
  for (const mark of STAGE_MARKS) {
    if (days >= mark.at) return mark.stage;
  }
  return 'none';
}

// A sent/partial invoice that's at least a day past due should flip to overdue.
export function shouldMarkOverdue(status: string, days: number): boolean {
  return days >= 1 && (status === 'sent' || status === 'partial');
}
