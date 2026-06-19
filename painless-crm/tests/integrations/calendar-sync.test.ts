import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({ serverEnv: vi.fn() }));
vi.mock('@/lib/env', () => envMock);

const adminMock = vi.hoisted(() => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock('@/lib/supabase/admin', () => adminMock);

const clientMock = vi.hoisted(() => ({
  insertEvent: vi.fn(),
  patchEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));
vi.mock('@/lib/integrations/google-calendar/client', () => clientMock);

const linksMock = vi.hoisted(() => ({
  readCalendarLink: vi.fn(),
  upsertCalendarLink: vi.fn(),
  markLinkSynced: vi.fn(),
  markLinkFailed: vi.fn(),
  markLinkDeleted: vi.fn(),
}));
vi.mock('@/lib/integrations/google-calendar/links', () => linksMock);

import { runCalendarSync } from '@/lib/integrations/google-calendar/sync';

const COMPANY = '00000000-0000-0000-0000-000000000001';
const FULL_ENV = {
  GMAIL_SA_CLIENT_EMAIL: 'sa@project.iam.gserviceaccount.com',
  GMAIL_SA_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----',
  GOOGLE_CALENDAR_ORGANIZER: 'ops@painlessremovals.com',
  GOOGLE_CALENDAR_ID_SURVEYS: 'surveys@group.calendar.google.com',
  GOOGLE_CALENDAR_ID_MOVES: 'moves@group.calendar.google.com',
  WEBHOOK_COMPANY_ID: COMPANY,
};

const EVENT = {
  summary: 'Move — Smith (PR-1234)',
  description: 'brief',
  start: { dateTime: '2026-07-01T08:00:00.000Z', timeZone: 'Europe/London' },
  end: { dateTime: '2026-07-01T12:00:00.000Z', timeZone: 'Europe/London' },
  extendedProperties: { private: { crm_entity: 'job_move:job-1' } },
};

const LINK = {
  id: 'link-1',
  calendar_id: 'moves@group.calendar.google.com',
  external_event_id: 'ev1',
  etag: '"e1"',
  status: 'synced' as const,
  version: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  envMock.serverEnv.mockReturnValue(FULL_ENV);
  linksMock.readCalendarLink.mockResolvedValue(null);
});

describe('runCalendarSync — degrade', () => {
  it('no-ops when SA credentials are absent', async () => {
    envMock.serverEnv.mockReturnValue({ ...FULL_ENV, GMAIL_SA_PRIVATE_KEY: undefined });
    expect(
      await runCalendarSync({ entityType: 'job_move', entityId: 'job-1', event: EVENT }),
    ).toEqual({
      ok: false,
      reason: 'no_credentials',
    });
    expect(clientMock.insertEvent).not.toHaveBeenCalled();
  });

  it('no-ops when the organiser is unset', async () => {
    envMock.serverEnv.mockReturnValue({ ...FULL_ENV, GOOGLE_CALENDAR_ORGANIZER: undefined });
    const r = await runCalendarSync({ entityType: 'job_move', entityId: 'job-1', event: EVENT });
    expect(r).toEqual({ ok: false, reason: 'no_credentials' });
  });

  it('no-ops when the tenant is unset', async () => {
    envMock.serverEnv.mockReturnValue({ ...FULL_ENV, WEBHOOK_COMPANY_ID: undefined });
    const r = await runCalendarSync({ entityType: 'job_move', entityId: 'job-1', event: EVENT });
    expect(r).toEqual({ ok: false, reason: 'no_company' });
  });

  it('no-ops when the matching calendar id is unset', async () => {
    envMock.serverEnv.mockReturnValue({ ...FULL_ENV, GOOGLE_CALENDAR_ID_MOVES: undefined });
    const r = await runCalendarSync({ entityType: 'job_move', entityId: 'job-1', event: EVENT });
    expect(r).toEqual({ ok: false, reason: 'no_calendar' });
  });
});

describe('runCalendarSync — insert (no existing link)', () => {
  it('inserts onto the role calendar and records a synced link', async () => {
    clientMock.insertEvent.mockResolvedValue({ ok: true, data: { id: 'evNew', etag: '"eN"' } });
    const r = await runCalendarSync({ entityType: 'job_move', entityId: 'job-1', event: EVENT });

    expect(r).toEqual({ ok: true, action: 'inserted', eventId: 'evNew', errors: [] });
    expect(clientMock.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'ops@painlessremovals.com' }),
      'moves@group.calendar.google.com',
      EVENT,
    );
    expect(linksMock.upsertCalendarLink).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'synced', event: { id: 'evNew', etag: '"eN"' } }),
    );
  });

  it('selects the surveys calendar for a survey entity', async () => {
    clientMock.insertEvent.mockResolvedValue({ ok: true, data: { id: 'evS' } });
    await runCalendarSync({ entityType: 'survey', entityId: 'survey-1', event: EVENT });
    expect(clientMock.insertEvent).toHaveBeenCalledWith(
      expect.anything(),
      'surveys@group.calendar.google.com',
      EVENT,
    );
  });

  it('records a failed link (for retry) when the insert fails', async () => {
    clientMock.insertEvent.mockResolvedValue({
      ok: false,
      reason: 'request_failed',
      error: 'http_500',
    });
    const r = await runCalendarSync({ entityType: 'job_move', entityId: 'job-1', event: EVENT });

    expect(r.ok && r.action).toBe('noop');
    expect(r.ok && r.errors[0]).toContain('insert: http_500');
    expect(linksMock.upsertCalendarLink).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'failed', lastError: 'http_500' }),
    );
  });
});

describe('runCalendarSync — patch (existing link)', () => {
  beforeEach(() => linksMock.readCalendarLink.mockResolvedValue(LINK));

  it('patches the linked event in place and re-syncs the etag', async () => {
    clientMock.patchEvent.mockResolvedValue({ ok: true, data: { id: 'ev1', etag: '"e2"' } });
    const r = await runCalendarSync({ entityType: 'job_move', entityId: 'job-1', event: EVENT });

    expect(r).toEqual({ ok: true, action: 'updated', eventId: 'ev1', errors: [] });
    expect(clientMock.patchEvent).toHaveBeenCalledWith(
      expect.anything(),
      LINK.calendar_id,
      'ev1',
      EVENT,
    );
    expect(linksMock.markLinkSynced).toHaveBeenCalled();
    expect(clientMock.insertEvent).not.toHaveBeenCalled();
  });

  it('re-inserts when the linked event has vanished (404)', async () => {
    clientMock.patchEvent.mockResolvedValue({ ok: false, reason: 'request_failed', status: 404 });
    clientMock.insertEvent.mockResolvedValue({ ok: true, data: { id: 'evReborn' } });
    const r = await runCalendarSync({ entityType: 'job_move', entityId: 'job-1', event: EVENT });

    expect(r.ok && r.action).toBe('inserted');
    expect(clientMock.insertEvent).toHaveBeenCalled();
  });

  it('marks the link failed on a real patch error (no re-insert)', async () => {
    clientMock.patchEvent.mockResolvedValue({
      ok: false,
      reason: 'request_failed',
      status: 500,
      error: 'http_500',
    });
    const r = await runCalendarSync({ entityType: 'job_move', entityId: 'job-1', event: EVENT });

    expect(r.ok && r.action).toBe('noop');
    expect(linksMock.markLinkFailed).toHaveBeenCalled();
    expect(clientMock.insertEvent).not.toHaveBeenCalled();
  });
});

describe('runCalendarSync — delete (event = null)', () => {
  it('deletes the linked event and soft-deletes the link', async () => {
    linksMock.readCalendarLink.mockResolvedValue(LINK);
    clientMock.deleteEvent.mockResolvedValue({ ok: true, data: { deleted: true } });
    const r = await runCalendarSync({ entityType: 'job_move', entityId: 'job-1', event: null });

    expect(r).toEqual({ ok: true, action: 'deleted', eventId: null, errors: [] });
    expect(clientMock.deleteEvent).toHaveBeenCalledWith(expect.anything(), LINK.calendar_id, 'ev1');
    expect(linksMock.markLinkDeleted).toHaveBeenCalled();
  });

  it('no-ops when there is nothing to delete', async () => {
    linksMock.readCalendarLink.mockResolvedValue(null);
    const r = await runCalendarSync({ entityType: 'job_move', entityId: 'job-1', event: null });

    expect(r).toEqual({ ok: true, action: 'noop', eventId: null, errors: [] });
    expect(clientMock.deleteEvent).not.toHaveBeenCalled();
  });
});
