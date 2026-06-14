import { z } from 'zod';
import { defaultFreqFor, EVENT_CATALOG, normaliseEventKey } from './events';

// Per-user, per-event-type email frequency. Stored as
// notification_preferences.event_prefs jsonb: { [eventKey]: Frequency }.
// Read resiliently (ADR-034 style): malformed entries are dropped, never throw,
// so a bad stored config means "fall back to the catalog default", not a crash.

export const FREQUENCIES = ['off', 'immediate', 'hourly', 'daily', 'weekly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FrequencySchema = z.enum(FREQUENCIES);
export const EventPrefsSchema = z.record(z.string(), FrequencySchema);
export type EventPrefs = Record<string, Frequency>;

const EVENT_KEY_SET = new Set(EVENT_CATALOG.map((e) => e.key));

function isCatalogKey(key: string): boolean {
  return EVENT_KEY_SET.has(key);
}

// Parse a stored event_prefs jsonb into a clean map. Unknown event keys and
// invalid frequencies are dropped; the result only contains catalog events the
// user has explicitly set (anything unset uses the catalog default at read).
export function parseEventPrefs(raw: unknown): EventPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: EventPrefs = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const normalised = normaliseEventKey(key);
    if (!isCatalogKey(normalised)) continue;
    const freq = FrequencySchema.safeParse(value);
    if (freq.success) out[normalised] = freq.data;
  }
  return out;
}

// Validate a form-submitted prefs map: keep only valid (catalog key, frequency)
// pairs. Used by the server action before persisting.
export function sanitiseEventPrefs(input: Record<string, string>): EventPrefs {
  const out: EventPrefs = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isCatalogKey(key)) continue;
    const freq = FrequencySchema.safeParse(value);
    if (freq.success) out[key] = freq.data;
  }
  return out;
}

// The user's effective frequency for an event: their explicit setting or the
// catalog default.
export function effectiveFreq(prefs: EventPrefs, eventKey: string): Frequency {
  const key = normaliseEventKey(eventKey);
  return prefs[key] ?? defaultFreqFor(key);
}

export interface SubscriberPref {
  user_id: string;
  prefs: EventPrefs;
}

// For a broadcast event: the user IDs whose effective frequency is not 'off'.
// These are the recipients who get an in-app notification row (and an email per
// their frequency). A user with no preference row still subscribes when the
// catalog default for the event is not 'off'.
export function resolveSubscribers(
  candidates: readonly SubscriberPref[],
  eventKey: string,
): string[] {
  return candidates
    .filter((c) => effectiveFreq(c.prefs, eventKey) !== 'off')
    .map((c) => c.user_id);
}
