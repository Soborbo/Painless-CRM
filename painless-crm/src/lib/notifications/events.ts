import type { Frequency } from './prefs';

// Notification event catalog (config-as-data, mirrors ADR-034). This is the
// single source of truth for both the subscription menu and the producers that
// emit notifications. Each event has a stable `key` (also stored as
// notifications.type), a UI group, bilingual labels, a delivery `scope`, and a
// `defaultFreq` used when a user has no explicit preference. Defaults are chosen
// so existing behaviour (mentions, assignments, SLA, complaints, damage,
// reviews) keeps emailing exactly as before.

export const EVENT_GROUPS = ['sales', 'ops', 'finance', 'care', 'collab'] as const;
export type EventGroup = (typeof EVENT_GROUPS)[number];

// 'broadcast' — on fire, fan out to every company user subscribed (freq != off).
// 'targeted' — recipient is intrinsic (the assignee / the mentioned user); the
//   subscription only controls whether/how it is emailed (the in-app row is
//   always created).
export type EventScope = 'broadcast' | 'targeted';

export interface NotificationEvent {
  key: string;
  group: EventGroup;
  labelEn: string;
  labelHu: string;
  scope: EventScope;
  defaultFreq: Frequency;
}

export const EVENT_CATALOG: readonly NotificationEvent[] = [
  // Sales
  { key: 'lead.created', group: 'sales', scope: 'broadcast', defaultFreq: 'daily', labelEn: 'New lead', labelHu: 'Új érdeklődő' },
  { key: 'lead.high_value_uncontacted', group: 'sales', scope: 'broadcast', defaultFreq: 'daily', labelEn: 'High-value lead, no callback', labelHu: 'Magas értékű lead, nincs visszahívás' },
  { key: 'lead.sla_breach', group: 'sales', scope: 'broadcast', defaultFreq: 'immediate', labelEn: 'Lead past first-response SLA', labelHu: 'Lead túllépte a válaszidőt' },
  { key: 'call.missed', group: 'sales', scope: 'broadcast', defaultFreq: 'immediate', labelEn: 'Missed inbound call', labelHu: 'Nem fogadott bejövő hívás' },
  { key: 'quote.created', group: 'sales', scope: 'broadcast', defaultFreq: 'daily', labelEn: 'Quote raised', labelHu: 'Árajánlat készült' },
  { key: 'quote.sent', group: 'sales', scope: 'broadcast', defaultFreq: 'off', labelEn: 'Quote sent', labelHu: 'Árajánlat elküldve' },
  { key: 'quote.accepted', group: 'sales', scope: 'broadcast', defaultFreq: 'immediate', labelEn: 'Quote accepted', labelHu: 'Árajánlat elfogadva' },
  { key: 'quote.declined', group: 'sales', scope: 'broadcast', defaultFreq: 'daily', labelEn: 'Quote declined', labelHu: 'Árajánlat elutasítva' },
  { key: 'quote.expiring', group: 'sales', scope: 'broadcast', defaultFreq: 'daily', labelEn: 'Quote about to expire', labelHu: 'Árajánlat hamarosan lejár' },
  // Ops
  { key: 'job.assigned', group: 'ops', scope: 'targeted', defaultFreq: 'immediate', labelEn: 'Job assigned to you', labelHu: 'Munka hozzád rendelve' },
  { key: 'job.stage_changed', group: 'ops', scope: 'broadcast', defaultFreq: 'off', labelEn: 'Job changed stage', labelHu: 'Munka állapota változott' },
  { key: 'job.booked', group: 'ops', scope: 'broadcast', defaultFreq: 'daily', labelEn: 'Job booked', labelHu: 'Munka lefoglalva' },
  { key: 'job.completed', group: 'ops', scope: 'broadcast', defaultFreq: 'daily', labelEn: 'Job completed', labelHu: 'Munka befejezve' },
  { key: 'job.cancelled', group: 'ops', scope: 'broadcast', defaultFreq: 'immediate', labelEn: 'Job cancelled', labelHu: 'Munka lemondva' },
  { key: 'callback.due', group: 'ops', scope: 'broadcast', defaultFreq: 'daily', labelEn: 'Callback due', labelHu: 'Esedékes visszahívás' },
  { key: 'survey.completed', group: 'ops', scope: 'broadcast', defaultFreq: 'daily', labelEn: 'Survey completed', labelHu: 'Felmérés kész' },
  { key: 'signoff.completed', group: 'ops', scope: 'broadcast', defaultFreq: 'daily', labelEn: 'Job signed off', labelHu: 'Munka leigazolva' },
  { key: 'clock_in.stale', group: 'ops', scope: 'broadcast', defaultFreq: 'immediate', labelEn: 'Crew not clocked in', labelHu: 'A csapat nem jelentkezett be' },
  { key: 'vehicle.compliance_due', group: 'ops', scope: 'broadcast', defaultFreq: 'daily', labelEn: 'Vehicle compliance due', labelHu: 'Jármű ellenőrzés esedékes' },
  // Finance
  { key: 'invoice.created', group: 'finance', scope: 'broadcast', defaultFreq: 'off', labelEn: 'Invoice created', labelHu: 'Számla létrehozva' },
  { key: 'payment.recorded', group: 'finance', scope: 'broadcast', defaultFreq: 'daily', labelEn: 'Payment received', labelHu: 'Fizetés beérkezett' },
  { key: 'invoice.overdue', group: 'finance', scope: 'broadcast', defaultFreq: 'daily', labelEn: 'Invoice overdue', labelHu: 'Számla lejárt' },
  // Care
  { key: 'complaint.created', group: 'care', scope: 'broadcast', defaultFreq: 'immediate', labelEn: 'New complaint', labelHu: 'Új panasz' },
  { key: 'complaint.sla_breach', group: 'care', scope: 'broadcast', defaultFreq: 'immediate', labelEn: 'Complaint past SLA', labelHu: 'Panasz túllépte a határidőt' },
  { key: 'damage.reported', group: 'care', scope: 'broadcast', defaultFreq: 'immediate', labelEn: 'Damage reported', labelHu: 'Kár jelentve' },
  { key: 'damage.escalated', group: 'care', scope: 'broadcast', defaultFreq: 'immediate', labelEn: 'Damage escalated', labelHu: 'Kár eszkalálva' },
  { key: 'review.received', group: 'care', scope: 'broadcast', defaultFreq: 'daily', labelEn: 'Review received', labelHu: 'Értékelés érkezett' },
  // Collaboration
  { key: 'mention', group: 'collab', scope: 'targeted', defaultFreq: 'immediate', labelEn: 'You were mentioned', labelHu: 'Megemlítettek' },
] as const;

const BY_KEY = new Map(EVENT_CATALOG.map((e) => [e.key, e]));

export function getEvent(key: string): NotificationEvent | undefined {
  return BY_KEY.get(key);
}

export function isEventKey(key: string): key is string {
  return BY_KEY.has(key);
}

export function eventKeys(): string[] {
  return EVENT_CATALOG.map((e) => e.key);
}

export function defaultFreqFor(key: string): Frequency {
  return BY_KEY.get(key)?.defaultFreq ?? 'off';
}

// Legacy notifications.type strings (pre-catalog) mapped to their new keys so
// historical rows resolve to a catalog event for labelling and delivery.
const LEGACY_TYPE_MAP: Record<string, string> = {
  assignment: 'job.assigned',
  sla_breach: 'lead.sla_breach',
  review_arrived: 'review.received',
  complaint: 'complaint.created',
  damage: 'damage.escalated',
};

export function normaliseEventKey(type: string): string {
  if (BY_KEY.has(type)) return type;
  return LEGACY_TYPE_MAP[type] ?? type;
}
