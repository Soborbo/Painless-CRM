// Phase 08 §Vehicles — compliance date status. Pure, date-injectable so both
// the vehicle detail UI and the daily reminder cron (Phase 08 §compliance
// auto-reminders) derive thresholds the same way. Reminder thresholds are
// 30/14/7 days before expiry.

export const COMPLIANCE_THRESHOLDS = [30, 14, 7] as const;
export type ComplianceThreshold = (typeof COMPLIANCE_THRESHOLDS)[number];

export type ComplianceState = 'expired' | 'due-soon' | 'ok' | 'none';

export interface ComplianceStatus {
  state: ComplianceState;
  daysUntil: number | null; // negative = overdue; null when no date set
}

// Whole-day difference between a YYYY-MM-DD due date and `today`, computed in
// UTC so it never drifts with the server's local timezone.
export function daysUntilDue(dueDate: string | null | undefined, today: Date): number | null {
  if (!dueDate) return null;
  const due = Date.parse(`${dueDate}T00:00:00.000Z`);
  if (Number.isNaN(due)) return null;
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((due - todayUtc) / 86_400_000);
}

export function complianceStatus(
  dueDate: string | null | undefined,
  today: Date,
): ComplianceStatus {
  const daysUntil = daysUntilDue(dueDate, today);
  if (daysUntil === null) return { state: 'none', daysUntil: null };
  if (daysUntil < 0) return { state: 'expired', daysUntil };
  if (daysUntil <= COMPLIANCE_THRESHOLDS[0]) return { state: 'due-soon', daysUntil };
  return { state: 'ok', daysUntil };
}

// The largest threshold the due date has just crossed (i.e. days-until exactly
// equals 30, 14 or 7), or null if today is not a reminder day. Used by the cron
// to fire one alert per threshold without re-alerting every day in between.
export function reminderThresholdFor(
  dueDate: string | null | undefined,
  today: Date,
): ComplianceThreshold | null {
  const daysUntil = daysUntilDue(dueDate, today);
  if (daysUntil === null) return null;
  return COMPLIANCE_THRESHOLDS.find((t) => t === daysUntil) ?? null;
}
