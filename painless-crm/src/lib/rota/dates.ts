// Phase 08 §Rota — small UTC date helpers for the rota index strip and the
// day view's prev/next navigation. Pure and timezone-stable (everything in UTC),
// so a YYYY-MM-DD never drifts a day across the server's local zone.

export function isValidYmd(value: string | undefined | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

export function addDaysYmd(ymd: string, delta: number): string {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`);
  const d = new Date(ms);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function enumerateDates(startYmd: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) out.push(addDaysYmd(startYmd, i));
  return out;
}

export function todayYmd(now: Date): string {
  return now.toISOString().slice(0, 10);
}
