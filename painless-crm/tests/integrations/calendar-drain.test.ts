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
  listPendingLinks: vi.fn(),
  markCalendarDirty: vi.fn(),
}));
vi.mock('@/lib/integrations/google-calendar/links', () => linksMock);

const loadMock = vi.hoisted(() => ({ buildEntityEvent: vi.fn() }));
vi.mock('@/lib/integrations/google-calendar/load', () => loadMock);

import { markEntityDirty } from '@/lib/integrations/google-calendar/dirty';
import { drainCalendarSync, syncEntityCalendar } from '@/lib/integrations/google-calendar/sync';

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

describe('syncEntityCalendar', () => {
  it('rebuilds the event from the DB and inserts it', async () => {
    loadMock.buildEntityEvent.mockResolvedValue(EVENT);
    clientMock.insertEvent.mockResolvedValue({ ok: true, data: { id: 'evNew' } });

    const r = await syncEntityCalendar('job_move', 'job-1');
    expect(r).toEqual({ ok: true, action: 'inserted', eventId: 'evNew', errors: [] });
    expect(loadMock.buildEntityEvent).toHaveBeenCalledWith(expect.anything(), 'job_move', 'job-1');
  });

  it('deletes when the entity is no longer syncable (event = null)', async () => {
    loadMock.buildEntityEvent.mockResolvedValue(null);
    linksMock.readCalendarLink.mockResolvedValue(LINK);
    clientMock.deleteEvent.mockResolvedValue({ ok: true, data: { deleted: true } });

    const r = await syncEntityCalendar('job_move', 'job-1');
    expect(r.ok && r.action).toBe('deleted');
    expect(clientMock.deleteEvent).toHaveBeenCalled();
  });
});

describe('drainCalendarSync', () => {
  it('no-ops without scanning when creds are absent', async () => {
    envMock.serverEnv.mockReturnValue({ ...FULL_ENV, GMAIL_SA_PRIVATE_KEY: undefined });
    const r = await drainCalendarSync();
    expect(r).toEqual({ due: 0, inserted: 0, updated: 0, deleted: 0, noop: 0, skipped: 0 });
    expect(linksMock.listPendingLinks).not.toHaveBeenCalled();
  });

  it('drains each pending link and tallies the outcomes', async () => {
    linksMock.listPendingLinks.mockResolvedValue([
      { entity_type: 'job_move', entity_id: 'job-1' },
      { entity_type: 'survey', entity_id: 'sv1' },
    ]);
    loadMock.buildEntityEvent.mockResolvedValue(EVENT);
    clientMock.insertEvent.mockResolvedValue({ ok: true, data: { id: 'evNew' } });

    const r = await drainCalendarSync();
    expect(r.due).toBe(2);
    expect(r.inserted).toBe(2);
    expect(clientMock.insertEvent).toHaveBeenCalledTimes(2);
  });
});

describe('markEntityDirty', () => {
  it('flags a move against the moves calendar', async () => {
    await markEntityDirty('job_move', 'job-1', COMPANY);
    expect(linksMock.markCalendarDirty).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: 'job_move',
        entityId: 'job-1',
        calendarId: 'moves@group.calendar.google.com',
      }),
      expect.any(Date),
    );
  });

  it('flags a survey against the surveys calendar', async () => {
    await markEntityDirty('survey', 'sv1', COMPANY);
    expect(linksMock.markCalendarDirty).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ calendarId: 'surveys@group.calendar.google.com' }),
      expect.any(Date),
    );
  });

  it('no-ops when the matching calendar id is unset', async () => {
    envMock.serverEnv.mockReturnValue({ ...FULL_ENV, GOOGLE_CALENDAR_ID_MOVES: undefined });
    await markEntityDirty('job_move', 'job-1', COMPANY);
    expect(linksMock.markCalendarDirty).not.toHaveBeenCalled();
  });

  it('never throws — a failure is swallowed', async () => {
    linksMock.markCalendarDirty.mockRejectedValue(new Error('db down'));
    await expect(markEntityDirty('job_move', 'job-1', COMPANY)).resolves.toBeUndefined();
  });
});
