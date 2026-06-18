import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({ serverEnv: vi.fn() }));
vi.mock('@/lib/env', () => envMock);

const adminMock = vi.hoisted(() => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock('@/lib/supabase/admin', () => adminMock);

const clientMock = vi.hoisted(() => ({
  historyList: vi.fn(),
  messagesList: vi.fn(),
  messagesGet: vi.fn(),
  getProfile: vi.fn(),
}));
vi.mock('@/lib/integrations/gmail/client', () => clientMock);

const ingestMock = vi.hoisted(() => ({
  ingestGmailMessages: vi.fn(),
  readSyncCursor: vi.fn(),
  writeSyncCursor: vi.fn(),
}));
vi.mock('@/lib/integrations/gmail/ingest', () => ingestMock);

import { runGmailPoll } from '@/lib/integrations/gmail/poll';

const MAILBOX = 'info@painlessremovals.com';
const COMPANY = '00000000-0000-0000-0000-000000000001';

const FULL_ENV = {
  GMAIL_SA_CLIENT_EMAIL: 'sa@project.iam.gserviceaccount.com',
  GMAIL_SA_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----',
  GMAIL_MAILBOX: MAILBOX,
  GMAIL_BACKFILL_DAYS: 7,
  WEBHOOK_COMPANY_ID: COMPANY,
};

const MESSAGE = {
  id: 'mX',
  threadId: 'tX',
  internalDate: '1718700000000',
  snippet: 's',
  payload: {
    headers: [
      { name: 'From', value: 'jane@example.com' },
      { name: 'To', value: MAILBOX },
      { name: 'Subject', value: 'Hi' },
    ],
  },
};

const INGEST_RESULT = {
  mapped: 1,
  skipped: 0,
  upserted: 1,
  matchedCustomer: 0,
  createdCustomer: 1,
  notified: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  envMock.serverEnv.mockReturnValue(FULL_ENV);
  ingestMock.ingestGmailMessages.mockResolvedValue(INGEST_RESULT);
  ingestMock.writeSyncCursor.mockResolvedValue(undefined);
  clientMock.messagesGet.mockResolvedValue({ ok: true, data: MESSAGE });
});

describe('runGmailPoll — degrade', () => {
  it('no-ops with a typed reason when SA credentials are absent', async () => {
    envMock.serverEnv.mockReturnValue({ ...FULL_ENV, GMAIL_SA_CLIENT_EMAIL: undefined });
    const res = await runGmailPoll();
    expect(res).toEqual({ ok: false, reason: 'no_credentials' });
    expect(clientMock.getProfile).not.toHaveBeenCalled();
    expect(clientMock.historyList).not.toHaveBeenCalled();
  });

  it('no-ops when the tenant company is absent', async () => {
    envMock.serverEnv.mockReturnValue({ ...FULL_ENV, WEBHOOK_COMPANY_ID: undefined });
    expect(await runGmailPoll()).toEqual({ ok: false, reason: 'no_company' });
  });
});

describe('runGmailPoll — first run (backfill)', () => {
  it('lists a date window, ingests, and seeds the cursor from the profile', async () => {
    ingestMock.readSyncCursor.mockResolvedValue(null);
    clientMock.getProfile.mockResolvedValue({ ok: true, data: { historyId: 'H100' } });
    clientMock.messagesList.mockResolvedValue({ ok: true, data: { messages: [{ id: 'm1' }] } });

    const now = new Date('2026-06-18T10:00:00Z');
    const res = await runGmailPoll(now);

    expect(res.ok && res.mode).toBe('backfill');
    expect(res.ok && res.historyId).toBe('H100');
    expect(res.ok && res.fetched).toBe(1);
    expect(clientMock.messagesList).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ q: 'newer_than:7d' }),
    );
    expect(clientMock.historyList).not.toHaveBeenCalled();
    expect(ingestMock.writeSyncCursor).toHaveBeenCalledWith(
      expect.anything(),
      COMPANY,
      MAILBOX,
      'H100',
      now,
    );
  });
});

describe('runGmailPoll — incremental (history delta)', () => {
  it('uses the stored cursor and advances it to the new historyId', async () => {
    ingestMock.readSyncCursor.mockResolvedValue('H50');
    clientMock.historyList.mockResolvedValue({
      ok: true,
      data: {
        history: [{ messagesAdded: [{ message: { id: 'm2' } }] }],
        historyId: 'H60',
      },
    });

    const res = await runGmailPoll();

    expect(res.ok && res.mode).toBe('history');
    expect(res.ok && res.historyId).toBe('H60');
    expect(clientMock.messagesGet).toHaveBeenCalledWith(expect.anything(), 'm2');
    expect(clientMock.getProfile).not.toHaveBeenCalled();
    expect(clientMock.messagesList).not.toHaveBeenCalled();
    expect(ingestMock.writeSyncCursor).toHaveBeenCalledWith(
      expect.anything(),
      COMPANY,
      MAILBOX,
      'H60',
      expect.any(Date),
    );
  });
});

describe('runGmailPoll — expired-history fallback', () => {
  it('falls back to a backfill and overwrites the cursor on a 404', async () => {
    ingestMock.readSyncCursor.mockResolvedValue('H10');
    clientMock.historyList.mockResolvedValue({ ok: false, reason: 'request_failed', status: 404 });
    clientMock.getProfile.mockResolvedValue({ ok: true, data: { historyId: 'H200' } });
    clientMock.messagesList.mockResolvedValue({ ok: true, data: { messages: [{ id: 'm3' }] } });

    const res = await runGmailPoll();

    expect(res.ok && res.mode).toBe('backfill');
    expect(res.ok && res.historyId).toBe('H200');
    expect(clientMock.messagesList).toHaveBeenCalled();
    expect(ingestMock.writeSyncCursor).toHaveBeenCalledWith(
      expect.anything(),
      COMPANY,
      MAILBOX,
      'H200',
      expect.any(Date),
    );
  });
});
