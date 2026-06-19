import type { createAdminClient } from '@/lib/supabase/admin';
import type { CalendarEventResponse } from './client';

// calendar_links persistence — the idempotency + lifecycle spine (ADR-045,
// migration 61). One live row per (company, provider, entity) maps a survey /
// move to its external event so a re-run patches instead of duplicating. Writes
// use optimistic concurrency (rule 12) and soft delete (rule 11).

type AnyClient = ReturnType<typeof createAdminClient>;

const TABLE = 'calendar_links';
const PROVIDER = 'google';

export type CalendarEntityType = 'survey' | 'job_move';
export type CalendarLinkStatus = 'pending' | 'synced' | 'failed' | 'deleted';

export interface CalendarLinkRow {
  id: string;
  calendar_id: string;
  external_event_id: string | null;
  etag: string | null;
  status: CalendarLinkStatus;
  version: number;
}

export async function readCalendarLink(
  supabase: AnyClient,
  companyId: string,
  entityType: CalendarEntityType,
  entityId: string,
): Promise<CalendarLinkRow | null> {
  const { data } = await supabase
    .from(TABLE)
    .select('id, calendar_id, external_event_id, etag, status, version')
    .eq('company_id', companyId)
    .eq('provider', PROVIDER)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as CalendarLinkRow | null) ?? null;
}

export interface UpsertLinkParams {
  companyId: string;
  entityType: CalendarEntityType;
  entityId: string;
  calendarId: string;
  existing: CalendarLinkRow | null;
  event?: CalendarEventResponse;
  status: CalendarLinkStatus;
  lastError?: string;
  now: Date;
}

// Insert a fresh link or advance the existing one (id + version guarded). Used
// after an insert (synced) and after a failed insert (failed, for retry).
export async function upsertCalendarLink(supabase: AnyClient, p: UpsertLinkParams): Promise<void> {
  const synced = p.status === 'synced';
  const fields = {
    calendar_id: p.calendarId,
    external_event_id: p.event?.id ?? p.existing?.external_event_id ?? null,
    etag: p.event?.etag ?? null,
    html_link: p.event?.htmlLink ?? null,
    status: p.status,
    last_synced_at: synced ? p.now.toISOString() : null,
    last_error: p.lastError ?? null,
  };

  if (p.existing) {
    await supabase
      .from(TABLE)
      .update({ ...fields, version: p.existing.version + 1 })
      .eq('id', p.existing.id)
      .eq('version', p.existing.version);
    return;
  }
  await supabase.from(TABLE).insert({
    company_id: p.companyId,
    entity_type: p.entityType,
    entity_id: p.entityId,
    provider: PROVIDER,
    ...fields,
  });
}

// Patch succeeded: record the new etag, keep the same external event id.
export async function markLinkSynced(
  supabase: AnyClient,
  link: CalendarLinkRow,
  event: CalendarEventResponse,
  now: Date,
): Promise<void> {
  await supabase
    .from(TABLE)
    .update({
      etag: event.etag ?? null,
      html_link: event.htmlLink ?? null,
      status: 'synced',
      last_synced_at: now.toISOString(),
      last_error: null,
      version: link.version + 1,
    })
    .eq('id', link.id)
    .eq('version', link.version);
}

export async function markLinkFailed(
  supabase: AnyClient,
  link: CalendarLinkRow,
  error: string,
  now: Date,
): Promise<void> {
  await supabase
    .from(TABLE)
    .update({
      status: 'failed',
      last_error: error,
      updated_at: now.toISOString(),
      version: link.version + 1,
    })
    .eq('id', link.id)
    .eq('version', link.version);
}

// Event removed upstream (cancel / unschedule). calendar_links is sync STATE,
// not user content, so we KEEP the row (status='deleted') and clear the event id
// rather than soft-deleting it: the unique (company, provider, entity) slot is
// then reused by an in-place update if the entity is later re-activated
// (markCalendarDirty), and a fresh insert follows since external_event_id is null.
export async function markLinkDeleted(
  supabase: AnyClient,
  link: CalendarLinkRow,
  now: Date,
): Promise<void> {
  await supabase
    .from(TABLE)
    .update({
      status: 'deleted',
      external_event_id: null,
      etag: null,
      last_synced_at: now.toISOString(),
      version: link.version + 1,
    })
    .eq('id', link.id)
    .eq('version', link.version);
}

// Producer side of the drain: flag an entity as needing a push. Upserts a
// 'pending' link (keeping an existing event id so the drain patches, not
// re-inserts). Best-effort — the caller wraps it so a failure never breaks the
// originating mutation.
export async function markCalendarDirty(
  supabase: AnyClient,
  args: { companyId: string; entityType: CalendarEntityType; entityId: string; calendarId: string },
  now: Date,
): Promise<void> {
  const existing = await readCalendarLink(supabase, args.companyId, args.entityType, args.entityId);
  if (existing) {
    await supabase
      .from(TABLE)
      .update({ status: 'pending', last_error: null, version: existing.version + 1 })
      .eq('id', existing.id)
      .eq('version', existing.version);
    return;
  }
  await supabase.from(TABLE).insert({
    company_id: args.companyId,
    entity_type: args.entityType,
    entity_id: args.entityId,
    provider: PROVIDER,
    calendar_id: args.calendarId,
    status: 'pending',
  });
}

export interface PendingLink {
  entity_type: CalendarEntityType;
  entity_id: string;
}

// Consumer side: the entities the drain cron still needs to push, oldest first.
export async function listPendingLinks(supabase: AnyClient, limit: number): Promise<PendingLink[]> {
  const { data } = await supabase
    .from(TABLE)
    .select('entity_type, entity_id')
    .is('deleted_at', null)
    .in('status', ['pending', 'failed'])
    .order('updated_at', { ascending: true })
    .limit(limit);
  return (data as PendingLink[] | null) ?? [];
}
