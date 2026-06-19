import type { GoogleEventResource } from '@/lib/calendar/event';
import { type CalendarCreds, getAccessToken } from './auth';

// Thin client over the Google Calendar REST API (events.insert / patch /
// delete). Push-based: the automation drain drives it. Portable — depends only
// on auth.ts + the pure event type, NOT on env or Supabase. Every call degrades
// to a typed failure (never throws); `status` is surfaced so the orchestrator
// can treat a 404/410 on patch as "event vanished, re-insert".

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

export type CalendarClientConfig = CalendarCreds;

export interface CalendarEventResponse {
  id: string;
  etag?: string;
  htmlLink?: string;
  status?: string;
}

export type CalendarApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason: 'auth_failed' | 'request_failed' | 'bad_response';
      status?: number;
      error?: string;
    };

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 200) : 'fetch_error';
}

async function bearer(config: CalendarClientConfig): Promise<string | null> {
  const tok = await getAccessToken(config);
  return tok.ok ? tok.token : null;
}

function eventsUrl(calendarId: string, eventId?: string): string {
  const base = `${CALENDAR_BASE}/${encodeURIComponent(calendarId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

async function writeEvent(
  config: CalendarClientConfig,
  url: string,
  method: 'POST' | 'PATCH',
  body: unknown,
): Promise<CalendarApiResult<CalendarEventResponse>> {
  const token = await bearer(config);
  if (!token) return { ok: false, reason: 'auth_failed', error: 'no_token' };

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, reason: 'request_failed', error: errMsg(err) };
  }
  if (!res.ok) {
    return { ok: false, reason: 'request_failed', status: res.status, error: `http_${res.status}` };
  }
  try {
    return { ok: true, data: (await res.json()) as CalendarEventResponse };
  } catch {
    return { ok: false, reason: 'bad_response', error: 'invalid_json' };
  }
}

/** events.insert — create a new event, returning its id + etag. */
export function insertEvent(
  config: CalendarClientConfig,
  calendarId: string,
  event: GoogleEventResource,
): Promise<CalendarApiResult<CalendarEventResponse>> {
  return writeEvent(config, eventsUrl(calendarId), 'POST', event);
}

/** events.patch — merge changes into an existing event. A 404/410 (surfaced via
 *  `status`) means it was deleted upstream; the orchestrator then re-inserts. */
export function patchEvent(
  config: CalendarClientConfig,
  calendarId: string,
  eventId: string,
  patch: Partial<GoogleEventResource>,
): Promise<CalendarApiResult<CalendarEventResponse>> {
  return writeEvent(config, eventsUrl(calendarId, eventId), 'PATCH', patch);
}

/** events.delete — remove an event. 204 (deleted) and 404/410 (already gone)
 *  are both idempotent successes; only other non-2xx is a real failure. */
export async function deleteEvent(
  config: CalendarClientConfig,
  calendarId: string,
  eventId: string,
): Promise<CalendarApiResult<{ deleted: true }>> {
  const token = await bearer(config);
  if (!token) return { ok: false, reason: 'auth_failed', error: 'no_token' };

  let res: Response;
  try {
    res = await fetch(eventsUrl(calendarId, eventId), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    return { ok: false, reason: 'request_failed', error: errMsg(err) };
  }
  if (res.ok || res.status === 404 || res.status === 410) {
    return { ok: true, data: { deleted: true } };
  }
  return { ok: false, reason: 'request_failed', status: res.status, error: `http_${res.status}` };
}
