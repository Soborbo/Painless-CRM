import { normalizePhone } from '@/lib/migration/normalize';
import { z } from 'zod';
import { isOurNumber } from './numbers';

// Maps a Tamar CDR record into the shape we insert into `phone_calls`.
//
// IMPORTANT: the exact JSON field names returned by api.tamar.co.uk/cdrs are not
// pinned in the API manual we have. Rather than guess one name, we read each
// logical field from a list of candidate keys (pickField) and validate the
// extracted shape with Zod. When we see one real CDR sample, narrow the
// candidate lists below — nothing else needs to change.

// Tamar CDRs are raw provider objects with unknown extra fields.
export const TamarCdrSchema = z.record(z.string(), z.unknown());
export type TamarCdr = z.infer<typeof TamarCdrSchema>;
export const TamarCdrListSchema = z.array(TamarCdrSchema);

// Logical field -> candidate provider keys, most-likely first.
const CANDIDATE_KEYS = {
  id: ['uuid', 'id', 'uniqueid', 'unique_id', 'callid', 'call_id', 'cdr_id', 'reference'],
  caller: ['caller', 'cli', 'from', 'source', 'src', 'caller_number', 'callerid', 'a_number'],
  called: ['called', 'destination', 'to', 'dest', 'number', 'did', 'called_number', 'b_number'],
  startedAt: ['start', 'start_time', 'started_at', 'calldate', 'datetime', 'time', 'date', 'timestamp'],
  duration: ['duration', 'billsec', 'duration_seconds', 'seconds', 'talk_time', 'talktime'],
  disposition: ['call_result', 'disposition', 'status', 'result', 'state'],
} as const;

function pickField(raw: TamarCdr, keys: readonly string[]): unknown {
  for (const k of keys) {
    const v = raw[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function toIso(v: unknown): string | null {
  if (typeof v === 'number') {
    // Heuristic: seconds vs. milliseconds since epoch.
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === 'string') {
    // Tamar sends "2023-01-09 10:04:48" (no timezone). Normalise the space to
    // 'T' so Date.parse treats it as a valid local datetime deterministically.
    // NOTE: Tamar times are UK-local with no offset; parsed as runtime-local
    // (UTC on Workers), so stored instants may be off by the BST hour. Refine
    // with an explicit Europe/London conversion if exact wall-clock matters.
    const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v.trim())
      ? v.trim().replace(' ', 'T')
      : v;
    const t = Date.parse(iso);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  return null;
}

function toDurationSeconds(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v === 'string') {
    const s = v.trim();
    // Tamar sends decimal seconds ("0.000", "125.000"); also accept plain ints.
    if (/^\d+(\.\d+)?$/.test(s)) return Math.max(0, Math.round(Number.parseFloat(s)));
    // Clock form ("00:01:23" / "1:23").
    const parts = s.split(':').map((p) => Number.parseInt(p, 10));
    if (parts.length >= 2 && parts.every((n) => Number.isFinite(n))) {
      return parts.reduce((acc, n) => acc * 60 + n, 0);
    }
  }
  return 0;
}

// Whether the call connected. Tamar's `call_result` is "Answered" / "Not
// answered" / "Engaged" etc. Anything that isn't clearly "answered" is treated
// as a missed opportunity (the caller didn't get through). When no disposition
// is present, fall back to talk-time: zero seconds == not connected.
function isMissedCall(disposition: string | null, durationSeconds: number): boolean {
  if (disposition && disposition.trim() !== '') {
    return disposition.trim().toLowerCase() !== 'answered';
  }
  return durationSeconds === 0;
}

export interface MappedCall {
  external_id: string;
  source: 'tamar_api';
  direction: 'inbound' | 'outbound';
  caller_number: string | null;
  called_number: string | null;
  duration_seconds: number;
  occurred_at: string;
  outcome: string | null;
  /** Caller did not get through (not answered / engaged / no talk time). */
  missed: boolean;
}

export type MapCdrResult =
  | { ok: true; call: MappedCall }
  | { ok: false; reason: 'no_id' | 'no_timestamp' };

/** Pure transform: one Tamar CDR -> a `phone_calls` insert shape (or a typed
 *  skip reason). Direction is derived from our own numbers: a call *to* one of
 *  them is inbound. */
export function mapCdrToPhoneCall(raw: TamarCdr, ourNumbers: string[]): MapCdrResult {
  const idRaw = pickField(raw, CANDIDATE_KEYS.id);
  const externalId =
    typeof idRaw === 'string' ? idRaw : typeof idRaw === 'number' ? String(idRaw) : null;
  if (!externalId) return { ok: false, reason: 'no_id' };

  const occurredAt = toIso(pickField(raw, CANDIDATE_KEYS.startedAt));
  if (!occurredAt) return { ok: false, reason: 'no_timestamp' };

  const callerRaw = pickField(raw, CANDIDATE_KEYS.caller);
  const calledRaw = pickField(raw, CANDIDATE_KEYS.called);
  const caller = typeof callerRaw === 'string' ? normalizePhone(callerRaw) : null;
  const called = typeof calledRaw === 'string' ? normalizePhone(calledRaw) : null;

  // A call to one of our numbers is inbound; from one of ours is outbound;
  // otherwise default inbound (the CDR set is queried by our number, so our
  // number is one side — inbound is the safe assumption for the call inbox).
  let direction: 'inbound' | 'outbound' = 'inbound';
  if (isOurNumber(ourNumbers, called)) direction = 'inbound';
  else if (isOurNumber(ourNumbers, caller)) direction = 'outbound';

  const disposition = pickField(raw, CANDIDATE_KEYS.disposition);
  const outcome = typeof disposition === 'string' ? disposition.slice(0, 60) : null;
  const durationSeconds = toDurationSeconds(pickField(raw, CANDIDATE_KEYS.duration));

  return {
    ok: true,
    call: {
      external_id: externalId,
      source: 'tamar_api',
      direction,
      caller_number: caller,
      called_number: called,
      duration_seconds: durationSeconds,
      occurred_at: occurredAt,
      outcome,
      missed: isMissedCall(outcome, durationSeconds),
    },
  };
}
