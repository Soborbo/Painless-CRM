import type { GoogleEventResource } from '@/lib/calendar/event';
import { serverEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { CALENDAR_SCOPE } from './auth';
import { type CalendarClientConfig, deleteEvent, insertEvent, patchEvent } from './client';
import {
  type CalendarEntityType,
  listPendingLinks,
  markLinkDeleted,
  markLinkFailed,
  markLinkSynced,
  readCalendarLink,
  upsertCalendarLink,
} from './links';
import { buildEntityEvent } from './load';

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

const DRAIN_MAX = 200;

export interface CalendarDrainResult {
  due: number;
  inserted: number;
  updated: number;
  deleted: number;
  noop: number;
  skipped: number;
}

// Rebuild an entity's event from current DB state, then push it. The single
// entry a manual "Sync now" button and the drain both call.
export async function syncEntityCalendar(
  entityType: CalendarEntityType,
  entityId: string,
  now: Date = new Date(),
): Promise<CalendarSyncResult> {
  const supabase = createAdminClient();
  const event = await buildEntityEvent(supabase, entityType, entityId);
  return runCalendarSync({ entityType, entityId, event, now });
}

// Drain the pending / failed calendar_links (the cron entry). Each entity is
// rebuilt and pushed; runCalendarSync flips its link to synced / failed /
// deleted, so a transient failure is retried on the next tick. Skips the DB scan
// entirely when creds are absent (no-op, like the Gmail poll).
export async function drainCalendarSync(now: Date = new Date()): Promise<CalendarDrainResult> {
  const out: CalendarDrainResult = {
    due: 0,
    inserted: 0,
    updated: 0,
    deleted: 0,
    noop: 0,
    skipped: 0,
  };
  const env = serverEnv();
  if (
    !env.GMAIL_SA_CLIENT_EMAIL ||
    !env.GMAIL_SA_PRIVATE_KEY ||
    !env.GOOGLE_CALENDAR_ORGANIZER ||
    !env.WEBHOOK_COMPANY_ID
  ) {
    return out;
  }

  const supabase = createAdminClient();
  const pending = await listPendingLinks(supabase, DRAIN_MAX);
  out.due = pending.length;
  for (const link of pending) {
    const res = await syncEntityCalendar(link.entity_type, link.entity_id, now);
    if (!res.ok) {
      out.skipped += 1;
      continue;
    }
    out[res.action] += 1;
  }
  return out;
}
