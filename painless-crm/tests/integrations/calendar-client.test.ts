import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({ getAccessToken: vi.fn() }));
vi.mock('@/lib/integrations/google-calendar/auth', () => ({
  ...authMock,
  CALENDAR_SCOPE: 'https://www.googleapis.com/auth/calendar',
}));

import { deleteEvent, insertEvent, patchEvent } from '@/lib/integrations/google-calendar/client';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const CONFIG = {
  clientEmail: 'sa@project.iam.gserviceaccount.com',
  privateKeyPem: 'pem',
  subject: 'ops@painlessremovals.com',
  scope: 'https://www.googleapis.com/auth/calendar',
};
const CAL = 'surveys@group.calendar.google.com';
const EVENT = {
  summary: 'Move — Smith (PR-1234)',
  description: 'brief',
  start: { dateTime: '2026-07-01T08:00:00.000Z', timeZone: 'Europe/London' },
  end: { dateTime: '2026-07-01T12:00:00.000Z', timeZone: 'Europe/London' },
  extendedProperties: { private: { crm_entity: 'job_move:job-1' } },
};

function res(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.getAccessToken.mockResolvedValue({
    ok: true,
    token: 'tok',
    expiresAt: Date.now() + 3600_000,
  });
});

describe('insertEvent', () => {
  it('POSTs the event to the calendar and returns id + etag', async () => {
    fetchMock.mockResolvedValue(res(200, { id: 'ev1', etag: '"e1"', htmlLink: 'https://cal/ev1' }));
    const r = await insertEvent(CONFIG, CAL, EVENT);

    expect(r).toEqual({ ok: true, data: { id: 'ev1', etag: '"e1"', htmlLink: 'https://cal/ev1' } });
    expect(fetchMock).toHaveBeenCalledWith(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL)}/events`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
        body: JSON.stringify(EVENT),
      }),
    );
  });

  it('does not call fetch and returns auth_failed when the token mint fails', async () => {
    authMock.getAccessToken.mockResolvedValue({ ok: false, reason: 'token_request_failed' });
    const r = await insertEvent(CONFIG, CAL, EVENT);
    expect(r).toEqual({ ok: false, reason: 'auth_failed', error: 'no_token' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces the HTTP status on a non-2xx', async () => {
    fetchMock.mockResolvedValue(res(500, {}));
    const r = await insertEvent(CONFIG, CAL, EVENT);
    expect(r).toEqual({ ok: false, reason: 'request_failed', status: 500, error: 'http_500' });
  });
});

describe('patchEvent', () => {
  it('PATCHes the specific event by id', async () => {
    fetchMock.mockResolvedValue(res(200, { id: 'ev1', etag: '"e2"' }));
    const r = await patchEvent(CONFIG, CAL, 'ev1', { summary: 'changed' });

    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL)}/events/ev1`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ summary: 'changed' }) }),
    );
  });

  it('reports a 404 status so the orchestrator can re-insert', async () => {
    fetchMock.mockResolvedValue(res(404, {}));
    const r = await patchEvent(CONFIG, CAL, 'gone', { summary: 'x' });
    expect(r).toEqual({ ok: false, reason: 'request_failed', status: 404, error: 'http_404' });
  });
});

describe('deleteEvent', () => {
  it('treats 204 as an idempotent success', async () => {
    fetchMock.mockResolvedValue(res(204, null));
    const r = await deleteEvent(CONFIG, CAL, 'ev1');
    expect(r).toEqual({ ok: true, data: { deleted: true } });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/events/ev1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('treats 410 Gone as already deleted', async () => {
    fetchMock.mockResolvedValue(res(410, {}));
    const r = await deleteEvent(CONFIG, CAL, 'ev1');
    expect(r.ok).toBe(true);
  });

  it('fails on a real error status', async () => {
    fetchMock.mockResolvedValue(res(500, {}));
    const r = await deleteEvent(CONFIG, CAL, 'ev1');
    expect(r).toEqual({ ok: false, reason: 'request_failed', status: 500, error: 'http_500' });
  });
});
