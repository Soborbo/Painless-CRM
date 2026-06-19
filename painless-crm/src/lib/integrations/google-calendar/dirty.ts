import { serverEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { type CalendarEntityType, markCalendarDirty } from './links';

// Producer-facing entry (ADR-045): flag a survey / move as needing a calendar
// push, to be drained by the calendar-sync cron. Called best-effort from the
// stage-transition and brief-edit mutations — it NEVER throws (a calendar hiccup
// must not break the originating save) and no-ops silently when the matching
// calendar / tenant env is unset. Env-coupling stays here, not in the job
// actions, which just call markEntityDirty(...).
export async function markEntityDirty(
  entityType: CalendarEntityType,
  entityId: string,
  companyId: string,
  now: Date = new Date(),
): Promise<void> {
  try {
    const env = serverEnv();
    const calendarId =
      entityType === 'survey' ? env.GOOGLE_CALENDAR_ID_SURVEYS : env.GOOGLE_CALENDAR_ID_MOVES;
    if (!calendarId || !companyId) return;
    const supabase = createAdminClient();
    await markCalendarDirty(supabase, { companyId, entityType, entityId, calendarId }, now);
  } catch {
    // Best-effort: swallow so the caller's mutation is never affected.
  }
}
