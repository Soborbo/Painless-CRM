// Timezone-aware send-window math, ported from Soborbo/reviewengine `core/time.ts`.
// DST-safe: we never do raw offset arithmetic, we ask Intl for the local
// wall-clock of a given instant and step hour by hour.

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export interface LocalParts {
  /** 'YYYY-MM-DD' local date key. */
  dateKey: string;
  /** Local hour 0-23. */
  hour: number;
  /** ISO weekday 1=Mon .. 7=Sun. */
  weekday: number;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function fmt(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

export function localParts(instant: Date | string, timeZone: string): LocalParts {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  const parts = fmt(timeZone).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  let hour = Number(get('hour'));
  if (hour === 24) hour = 0; // some engines emit '24' for midnight
  // Weekday from the local calendar date (independent of time-of-day).
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun..6=Sat
  const weekday = dow === 0 ? 7 : dow; // ISO 1=Mon..7=Sun
  const dateKey = `${get('year')}-${get('month')}-${get('day')}`;
  return { dateKey, hour, weekday };
}

export function localDateKey(instant: Date | string, timeZone: string): string {
  return localParts(instant, timeZone).dateKey;
}

/** Whole-day difference between two 'YYYY-MM-DD' keys (b - a). */
export function dateKeyDiffDays(a: string, b: string): number {
  const pa = Date.parse(`${a}T00:00:00Z`);
  const pb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((pb - pa) / DAY_MS);
}

/**
 * Earliest instant at or after `from` whose local wall-clock falls in an allowed
 * send window (hour ∈ sendHours AND weekday ∈ sendDays). Aligned to a UTC hour
 * boundary so the hourly cron picks it up. DST-safe by stepping hour by hour.
 */
export function roundToWindow(
  from: Date | string,
  timeZone: string,
  sendHours: number[],
  sendDays: number[],
): string {
  const fromMs = (typeof from === 'string' ? new Date(from) : from).getTime();
  // Round up to the next UTC hour boundary.
  let ms = Math.ceil(fromMs / HOUR_MS) * HOUR_MS;
  const limit = ms + DAY_MS * 14; // safety bound (~2 weeks of windows)
  while (ms <= limit) {
    const p = localParts(new Date(ms), timeZone);
    if (sendDays.includes(p.weekday) && sendHours.includes(p.hour)) {
      return new Date(ms).toISOString();
    }
    ms += HOUR_MS;
  }
  return new Date(ms).toISOString();
}

/**
 * next_send_at for the attempt that will follow `attemptsSentAfter` sends.
 * scheduleDays are day offsets from trigger_at; index = attempts already sent.
 * Returns null when no further attempt is scheduled.
 */
export function computeNext(
  triggerAt: string,
  scheduleDays: number[],
  attemptsSentAfter: number,
  timeZone: string,
  sendHours: number[],
  sendDays: number[],
): string | null {
  const offset = scheduleDays[attemptsSentAfter];
  if (offset === undefined) return null;
  const target = new Date(Date.parse(triggerAt) + offset * DAY_MS);
  return roundToWindow(target, timeZone, sendHours, sendDays);
}

/**
 * Parse a caller-supplied service date into an ISO instant. Falls back to `now`
 * when the value is absent or unparseable — a bad date must never crash ingest
 * (`new Date('not a date').toISOString()` throws a RangeError).
 */
export function parseTriggerAt(input: string | null | undefined, now = new Date()): string {
  if (!input) return now.toISOString();
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? now.toISOString() : d.toISOString();
}

/** Initial next_send_at on insert (offset = scheduleDays[0]). */
export function initialNextSend(
  triggerAt: string,
  scheduleDays: number[],
  timeZone: string,
  sendHours: number[],
  sendDays: number[],
): string {
  return (
    computeNext(triggerAt, scheduleDays, 0, timeZone, sendHours, sendDays) ??
    roundToWindow(triggerAt, timeZone, sendHours, sendDays)
  );
}

/**
 * Warmup ramp value for `today` (deliverability pacing, engine spec §5).
 * sendingDayIndex = whole days since rampStartedAt (default = today).
 */
export function rampValueFor(
  ramp: number[] | null,
  rampStartedAt: string | null,
  dailySendCap: number,
  todayKey: string,
  timeZone: string,
): number {
  if (!ramp || ramp.length === 0) return dailySendCap;
  const startKey = rampStartedAt ? localDateKey(rampStartedAt, timeZone) : todayKey;
  const idx = Math.max(0, dateKeyDiffDays(startKey, todayKey));
  const rampVal = ramp[Math.min(idx, ramp.length - 1)] ?? dailySendCap;
  return Math.min(rampVal, dailySendCap);
}
