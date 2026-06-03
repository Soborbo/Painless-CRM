// Bound a client-supplied timestamp to a sane window around server time.
//
// Worker records carry `client_recorded_at` (when the button was pressed) so an
// offline-then-synced entry keeps its true time. But it is fully client-trusted
// and only shape-validated, so a wrong device clock — or a hand-crafted POST —
// could backdate/forward-date an entry (audit, data integrity), e.g. defeating
// the stale-clock-in nudge with a future timestamp. Clamp to [now-7d, now+5min]
// (7 days covers a realistic offline-replay backlog) and fall back to server
// time when out of range or unparseable.

const MAX_FUTURE_MS = 5 * 60 * 1000; // 5 minutes of clock skew
const MAX_PAST_MS = 7 * 24 * 60 * 60 * 1000; // 7-day offline-replay window

export function boundedClientTimestamp(
  clientIso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!clientIso) return now.toISOString();
  const t = Date.parse(clientIso);
  if (Number.isNaN(t)) return now.toISOString();
  const nowMs = now.getTime();
  if (t > nowMs + MAX_FUTURE_MS) return now.toISOString();
  if (t < nowMs - MAX_PAST_MS) return now.toISOString();
  return new Date(t).toISOString();
}
