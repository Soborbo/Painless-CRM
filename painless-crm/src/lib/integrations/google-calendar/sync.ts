import type { GoogleEventResource } from '@/lib/calendar/event';
import { serverEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { CALENDAR_SCOPE } from './auth';
import { type CalendarClientConfig, deleteEvent, insertEvent, patchEvent } from './client';
import {
  type CalendarEntityType,
  markLinkDeleted,
  markLinkFailed,
  markLinkSynced,
  readCalendarLink,
  upsertCalendarLink,
} from './links';

// Orchestrates one entity's calendar push (ADR-045), mirroring runGmailPoll's
// shape. Given a pre-built event (assembled by the caller via assembleJobBrief +
// briefToGoogleEvent) it inserts / patches / deletes the role-segmented calendar
// event and records the result in calendar_links so the next run is idempotent.
// Degrades to a typed no-op when creds / calendars / tenant config are absent —
// the caller (automation drain) then proceeds unaffected.

export type CalendarSyncResult =
  | { ok: false; reason: 'no_credentials' | 'no_calendar' | 'no_company' }
  | {
      ok: true;
      action: 'inserted' | 'updated' | 'deleted' | 'noop';
      eventId: string | null;
      errors: string[];
    };

export interface CalendarSyncArgs {
  entityType: CalendarEntityType;
  entityId: string;
  // The event resource to upsert, or null when the entity is unscheduled /
  // cancelled (any existing event is then deleted).
  event: GoogleEventResource | null;
  now?: Date;
}

export async function runCalendarSync(args: CalendarSyncArgs): Promise<CalendarSyncResult> {
  const env = serverEnv();
  if (!env.GMAIL_SA_CLIENT_EMAIL || !env.GMAIL_SA_PRIVATE_KEY || !env.GOOGLE_CALENDAR_ORGANIZER) {
    return { ok: false, reason: 'no_credentials' };
  }
  const companyId = env.WEBHOOK_COMPANY_ID;
  if (!companyId) return { ok: false, reason: 'no_company' };
  const calendarId =
    args.entityType === 'survey' ? env.GOOGLE_CALENDAR_ID_SURVEYS : env.GOOGLE_CALENDAR_ID_MOVES;
  if (!calendarId) return { ok: false, reason: 'no_calendar' };

  const config: CalendarClientConfig = {
    clientEmail: env.GMAIL_SA_CLIENT_EMAIL,
    privateKeyPem: env.GMAIL_SA_PRIVATE_KEY,
    subject: env.GOOGLE_CALENDAR_ORGANIZER,
    scope: CALENDAR_SCOPE,
  };
  const supabase = createAdminClient();
  const now = args.now ?? new Date();
  const errors: string[] = [];
  const link = await readCalendarLink(supabase, companyId, args.entityType, args.entityId);

  // Unscheduled / cancelled → remove any existing event.
  if (!args.event) {
    if (!link?.external_event_id) return { ok: true, action: 'noop', eventId: null, errors };
    const del = await deleteEvent(config, link.calendar_id, link.external_event_id);
    if (!del.ok) errors.push(`delete: ${del.error ?? del.reason}`);
    await markLinkDeleted(supabase, link, now);
    return { ok: true, action: 'deleted', eventId: null, errors };
  }

  // Existing event → patch in place; a 404/410 means it vanished, so re-insert.
  if (link?.external_event_id) {
    const patched = await patchEvent(config, link.calendar_id, link.external_event_id, args.event);
    if (patched.ok) {
      await markLinkSynced(supabase, link, patched.data, now);
      return { ok: true, action: 'updated', eventId: patched.data.id, errors };
    }
    if (patched.status !== 404 && patched.status !== 410) {
      const error = patched.error ?? patched.reason;
      errors.push(`patch: ${error}`);
      await markLinkFailed(supabase, link, error, now);
      return { ok: true, action: 'noop', eventId: link.external_event_id, errors };
    }
  }

  // Fresh insert (no link yet, or the old event was deleted upstream).
  const inserted = await insertEvent(config, calendarId, args.event);
  if (!inserted.ok) {
    const error = inserted.error ?? inserted.reason;
    errors.push(`insert: ${error}`);
    await upsertCalendarLink(supabase, {
      companyId,
      entityType: args.entityType,
      entityId: args.entityId,
      calendarId,
      existing: link,
      status: 'failed',
      lastError: error,
      now,
    });
    return { ok: true, action: 'noop', eventId: null, errors };
  }
  await upsertCalendarLink(supabase, {
    companyId,
    entityType: args.entityType,
    entityId: args.entityId,
    calendarId,
    existing: link,
    event: inserted.data,
    status: 'synced',
    now,
  });
  return { ok: true, action: 'inserted', eventId: inserted.data.id, errors };
}
