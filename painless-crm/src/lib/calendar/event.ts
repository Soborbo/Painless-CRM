import type { BriefLeg, JobBrief } from '@/lib/calendar/brief';

// Phase 28 — JobBrief → Google Calendar event resource (ADR-045). Pure: the
// brief is already audience-filtered, so this only formats. No I/O — the
// integration client posts the returned resource; this unit-tests directly.

export const DEFAULT_TIME_ZONE = 'Europe/London';
const DEFAULT_DURATION_MIN: Record<JobBrief['kind'], number> = { survey: 60, move: 240 };

export interface GoogleEventDateTime {
  dateTime: string; // RFC3339
  timeZone: string;
}

export interface GoogleEventResource {
  summary: string;
  location?: string;
  description: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
  extendedProperties: { private: Record<string, string> };
}

export interface EventOptions {
  entityType: 'survey' | 'job_move';
  entityId: string;
  timeZone?: string;
  durationMinutes?: number;
}

function legLine(leg: BriefLeg): string {
  const detail: string[] = [];
  if (leg.property_type) detail.push(leg.property_type);
  if (leg.floor != null) detail.push(`floor ${leg.floor}`);
  if (leg.has_lift != null) detail.push(leg.has_lift ? 'lift' : 'no lift');
  if (leg.has_parking != null) detail.push(leg.has_parking ? 'parking' : 'no parking');
  const meta = detail.length ? ` (${detail.join(', ')})` : '';
  const access = leg.access_notes ? `\n    access: ${leg.access_notes}` : '';
  return `${leg.role.toUpperCase()}: ${leg.address}${meta}${access}`;
}

function itemLine(qty: number, item: string, note?: string | null): string {
  const n = note?.trim() ? ` — ${note.trim()}` : '';
  return `  • ${qty}× ${item}${n}`;
}

function section(out: string[], heading: string, lines: string[]): void {
  if (!lines.length) return;
  out.push('', heading);
  out.push(...lines);
}

// The human-readable brief that lands in the event body on the crew's phones.
export function briefToDescription(brief: JobBrief): string {
  const out: string[] = [];
  if (brief.customerPhone) out.push(`☎ ${brief.customerName} — ${brief.customerPhone}`);
  if (brief.arrivalWindow) out.push(`Arrival: ${brief.arrivalWindow}`);
  section(out, 'Addresses:', brief.legs.map(legLine));
  section(
    out,
    'Dismantle:',
    brief.dismantle.map((i) => itemLine(i.quantity, i.item, i.room)),
  );
  section(
    out,
    'Reassemble:',
    brief.reassembly.map((i) => itemLine(i.quantity, i.item, i.room)),
  );
  section(
    out,
    'Kit to bring:',
    brief.kit.map((i) => itemLine(i.quantity, i.item, i.notes)),
  );
  section(
    out,
    'NOT going:',
    brief.excluded.map((i) => itemLine(i.quantity, i.item, i.notes)),
  );
  if (brief.cubicEstimate != null) out.push('', `Est. volume: ${brief.cubicEstimate} cu ft`);
  section(
    out,
    'Open tasks:',
    brief.openTasks.map((t) => `  • ${t.title}`),
  );
  section(
    out,
    'Notes:',
    brief.internalNotes.map((n) => `  ${n}`),
  );
  section(
    out,
    'Customer notes:',
    brief.customerNotes.map((n) => `  ${n}`),
  );
  return out.join('\n').trim();
}

function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

// Returns null when the entity has no scheduled time yet — the caller then skips
// the insert (or clears an existing link) rather than pushing a timeless event.
export function briefToGoogleEvent(
  brief: JobBrief,
  opts: EventOptions,
): GoogleEventResource | null {
  if (!brief.whenStart) return null;
  const timeZone = opts.timeZone ?? DEFAULT_TIME_ZONE;
  const duration = opts.durationMinutes ?? DEFAULT_DURATION_MIN[brief.kind];
  // Where the crew physically goes first: the pickup for a move, the property
  // for a survey (both are the 'from' leg), falling back to whatever exists.
  const primary = brief.legs.find((l) => l.role === 'from') ?? brief.legs[0];
  const start = new Date(brief.whenStart).toISOString();
  return {
    summary: brief.title,
    location: primary?.address,
    description: briefToDescription(brief),
    start: { dateTime: start, timeZone },
    end: { dateTime: addMinutesIso(start, duration), timeZone },
    extendedProperties: { private: { crm_entity: `${opts.entityType}:${opts.entityId}` } },
  };
}
