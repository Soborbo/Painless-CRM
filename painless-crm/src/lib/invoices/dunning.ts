// Phase 12 §9 — dunning cadence for overdue invoices. Pure + date-injectable.
// Stateless like the vehicle-compliance sweep: a reminder fires only on its
// exact day-overdue mark, so a daily cron sends each stage once without needing
// a "last reminder sent" ledger column.
//
//   T+3  → reminder1   (friendly)
//   T+7  → reminder2    (please reply)
//   T+14 → urgent
//   T+30 → admin        (escalate internally; auto-pause is configurable, later)

export type DunningStage = 'none' | 'reminder1' | 'reminder2' | 'urgent' | 'admin';

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysOverdue(dueAt: string, now: Date): number {
  const diff = now.getTime() - new Date(dueAt).getTime();
  return diff <= 0 ? 0 : Math.floor(diff / DAY_MS);
}

export function dunningStage(days: number): DunningStage {
  switch (days) {
    case 3:
      return 'reminder1';
    case 7:
      return 'reminder2';
    case 14:
      return 'urgent';
    case 30:
      return 'admin';
    default:
      return 'none';
  }
}

// A sent/partial invoice that's at least a day past due should flip to overdue.
export function shouldMarkOverdue(status: string, days: number): boolean {
  return days >= 1 && (status === 'sent' || status === 'partial');
}
