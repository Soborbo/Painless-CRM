import { serverEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { GMAIL_READONLY_SCOPE, type ServiceAccountCreds } from './auth';
import {
  type GmailClientConfig,
  type GmailMessageRef,
  getProfile,
  historyList,
  messagesGet,
  messagesList,
} from './client';
import {
  type GmailIngestResult,
  ingestGmailMessages,
  readSyncCursor,
  writeSyncCursor,
} from './ingest';
import { parseGmailMessage } from './parse';

// Orchestrates one Gmail poll cycle, mirroring runTamarPoll. With a stored
// history cursor it does an incremental users.history delta; on a first run (or
// when Gmail has purged the cursor → 404) it backfills the last N days and
// re-seeds the cursor from getProfile. New messages are fetched, parsed and
// ingested; the cursor is advanced at the end. Idempotent (the dedup guards the
// side-effects). Degrades to a typed no-op when creds/tenant config are absent.

export type GmailPollResult =
  | { ok: false; reason: 'no_credentials' | 'no_mailbox' | 'no_company' }
  | {
      ok: true;
      mode: 'history' | 'backfill';
      fetched: number;
      ingest: GmailIngestResult;
      historyId: string | null;
      errors: string[];
    };

const MAX_PAGES = 10; // safety bound on pagination per cycle

const EMPTY_INGEST: GmailIngestResult = {
  mapped: 0,
  skipped: 0,
  upserted: 0,
  matchedCustomer: 0,
  createdCustomer: 0,
  notified: 0,
};

export async function runGmailPoll(now: Date = new Date()): Promise<GmailPollResult> {
  const env = serverEnv();
  if (!env.GMAIL_SA_CLIENT_EMAIL || !env.GMAIL_SA_PRIVATE_KEY) {
    return { ok: false, reason: 'no_credentials' };
  }
  const mailbox = env.GMAIL_MAILBOX;
  if (!mailbox) return { ok: false, reason: 'no_mailbox' };
  const companyId = env.WEBHOOK_COMPANY_ID;
  if (!companyId) return { ok: false, reason: 'no_company' };

  const config: GmailClientConfig = {
    clientEmail: env.GMAIL_SA_CLIENT_EMAIL,
    privateKeyPem: env.GMAIL_SA_PRIVATE_KEY,
    subject: mailbox,
    scope: GMAIL_READONLY_SCOPE,
  } satisfies ServiceAccountCreds;

  const supabase = createAdminClient();
  const errors: string[] = [];
  const cursor = await readSyncCursor(supabase, companyId, mailbox);

  let mode: 'history' | 'backfill' = cursor ? 'history' : 'backfill';
  let messageIds: string[] = [];
  let newHistoryId: string | null = cursor;

  if (cursor) {
    const delta = await collectHistory(config, cursor);
    if (delta.ok) {
      messageIds = delta.ids;
      newHistoryId = delta.historyId ?? cursor;
    } else if (delta.status === 404) {
      mode = 'backfill'; // cursor purged by Gmail — resync from a date window
    } else {
      errors.push(`history: ${delta.error ?? delta.reason}`);
      return { ok: true, mode, fetched: 0, ingest: EMPTY_INGEST, historyId: cursor, errors };
    }
  }

  if (mode === 'backfill') {
    const days = env.GMAIL_BACKFILL_DAYS;
    const seed = await getProfile(config);
    if (seed.ok && seed.data.historyId) newHistoryId = seed.data.historyId;
    else if (!seed.ok) errors.push(`profile: ${seed.error ?? seed.reason}`);
    const list = await collectMessages(config, `newer_than:${days}d`);
    if (!list.ok) errors.push(`list: ${list.error}`);
    messageIds = list.ids;
  }

  const messages = [];
  for (const id of messageIds) {
    const got = await messagesGet(config, id);
    if (!got.ok) {
      errors.push(`get ${id}: ${got.error ?? got.reason}`);
      continue;
    }
    const parsed = parseGmailMessage(got.data, [mailbox]);
    if (parsed.ok) messages.push(parsed.email);
  }

  const ingest = await ingestGmailMessages(supabase, { companyId, mailbox, messages });

  if (newHistoryId) await writeSyncCursor(supabase, companyId, mailbox, newHistoryId, now);

  return { ok: true, mode, fetched: messages.length, ingest, historyId: newHistoryId, errors };
}

// --- pagination helpers -------------------------------------------------------

type CollectHistory =
  | { ok: true; ids: string[]; historyId: string | null }
  | { ok: false; reason: string; status?: number; error?: string };

async function collectHistory(
  config: GmailClientConfig,
  startHistoryId: string,
): Promise<CollectHistory> {
  const ids = new Set<string>();
  let historyId: string | null = null;
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await historyList(config, { startHistoryId, pageToken });
    if (!res.ok) return { ok: false, reason: res.reason, status: res.status, error: res.error };
    if (res.data.historyId) historyId = res.data.historyId;
    for (const h of res.data.history ?? []) {
      for (const added of h.messagesAdded ?? []) addId(ids, added.message);
    }
    if (!res.data.nextPageToken) break;
    pageToken = res.data.nextPageToken;
  }
  return { ok: true, ids: [...ids], historyId };
}

type CollectMessages = { ok: true; ids: string[] } | { ok: false; ids: string[]; error?: string };

async function collectMessages(config: GmailClientConfig, q: string): Promise<CollectMessages> {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const res = await messagesList(config, { q, pageToken });
    if (!res.ok) return { ok: false, ids: [...ids], error: res.error ?? res.reason };
    for (const m of res.data.messages ?? []) addId(ids, m);
    if (!res.data.nextPageToken) break;
    pageToken = res.data.nextPageToken;
  }
  return { ok: true, ids: [...ids] };
}

function addId(ids: Set<string>, ref: GmailMessageRef | undefined): void {
  if (ref?.id) ids.add(ref.id);
}
