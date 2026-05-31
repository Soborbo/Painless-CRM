// Human-readable "time remaining" for the SLA queue countdown (Phase 06b §1).
//
// Pure and timezone-free: takes epoch milliseconds so both the server (initial
// render) and the live client countdown share one source of truth and the
// formatting is trivially testable. A negative result is prefixed with '-'
// to read as overdue (e.g. "-12m", "-1h 05m").

export function formatRemaining(dueAtMs: number, nowMs: number): string {
  const diffMs = dueAtMs - nowMs;
  const overdue = diffMs < 0;
  const sign = overdue ? '-' : '';
  const totalMinutes = Math.floor(Math.abs(diffMs) / 60_000);

  if (totalMinutes < 60) return `${sign}${totalMinutes}m`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${sign}${hours}h ${String(minutes).padStart(2, '0')}m`;
}

// Whether the deadline has already passed at `nowMs`. Drives the live cell
// turning red the moment a lead tips into overdue, without a page refresh.
export function isOverdue(dueAtMs: number, nowMs: number): boolean {
  return dueAtMs - nowMs <= 0;
}
