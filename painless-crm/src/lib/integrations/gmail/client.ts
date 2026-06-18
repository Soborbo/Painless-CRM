import { type ServiceAccountCreds, getAccessToken } from './auth';
import type { GmailMessage } from './parse';

// Thin client over the Gmail REST API (users.history / messages.list /
// messages.get / getProfile). Pull-based, like the Tamar client: the poll cron
// drives it. Portable — depends only on auth.ts + parse types, NOT on env or
// Supabase — so the Gmail core stays liftable. Every call degrades to a typed
// failure (never throws); `status` is surfaced so the poll can detect a 404
// "historyId too old" and fall back to a backfill window.

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users';

export type GmailClientConfig = ServiceAccountCreds;

export type GmailApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason: 'auth_failed' | 'request_failed' | 'bad_response';
      status?: number;
      error?: string;
    };

export interface GmailMessageRef {
  id?: string;
  threadId?: string;
}

export interface HistoryListResponse {
  history?: Array<{ messagesAdded?: Array<{ message?: GmailMessageRef }> }>;
  historyId?: string;
  nextPageToken?: string;
}

export interface MessagesListResponse {
  messages?: GmailMessageRef[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface ProfileResponse {
  emailAddress?: string;
  historyId?: string;
}

async function gmailGet<T>(config: GmailClientConfig, path: string): Promise<GmailApiResult<T>> {
  const tok = await getAccessToken(config);
  if (!tok.ok) return { ok: false, reason: 'auth_failed', error: tok.reason };

  const url = `${GMAIL_BASE}/${encodeURIComponent(config.subject)}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${tok.token}`, Accept: 'application/json' },
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'request_failed',
      error: err instanceof Error ? err.message.slice(0, 200) : 'fetch_error',
    };
  }
  if (!res.ok) {
    return { ok: false, reason: 'request_failed', status: res.status, error: `http_${res.status}` };
  }
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, reason: 'bad_response', error: 'invalid_json' };
  }
}

/** users.history.list — delta of message-add events since `startHistoryId`.
 *  A 404 means the cursor is older than Gmail's ~1-week retention; the caller
 *  must backfill and re-seed the cursor. */
export function historyList(
  config: GmailClientConfig,
  params: { startHistoryId: string; pageToken?: string },
): Promise<GmailApiResult<HistoryListResponse>> {
  const q = new URLSearchParams({
    startHistoryId: params.startHistoryId,
    historyTypes: 'messageAdded',
  });
  if (params.pageToken) q.set('pageToken', params.pageToken);
  return gmailGet<HistoryListResponse>(config, `/history?${q.toString()}`);
}

/** users.messages.list — id refs matching a Gmail search `q` (e.g. newer_than). */
export function messagesList(
  config: GmailClientConfig,
  params: { q: string; pageToken?: string },
): Promise<GmailApiResult<MessagesListResponse>> {
  const q = new URLSearchParams({ q: params.q });
  if (params.pageToken) q.set('pageToken', params.pageToken);
  return gmailGet<MessagesListResponse>(config, `/messages?${q.toString()}`);
}

/** users.messages.get — one full message (headers + MIME body). */
export function messagesGet(
  config: GmailClientConfig,
  id: string,
): Promise<GmailApiResult<GmailMessage>> {
  return gmailGet<GmailMessage>(config, `/messages/${encodeURIComponent(id)}?format=full`);
}

/** users.getProfile — current mailbox `historyId`, used to seed the cursor on a
 *  first run / after a backfill so the next run can do an incremental delta. */
export function getProfile(config: GmailClientConfig): Promise<GmailApiResult<ProfileResponse>> {
  return gmailGet<ProfileResponse>(config, '/profile');
}
