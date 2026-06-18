import type { createAdminClient } from '@/lib/supabase/admin';
import { afterEach, describe, expect, it, vi } from 'vitest';

const emitMock = vi.hoisted(() => ({ emitEvent: vi.fn() }));
vi.mock('@/lib/notifications/emit', () => emitMock);

import { ingestGmailMessages } from '@/lib/integrations/gmail/ingest';
import type { MappedEmail } from '@/lib/integrations/gmail/parse';

type Result = { data?: unknown; error?: unknown };
type AdminClient = ReturnType<typeof createAdminClient>;

interface FakeConfig {
  seen?: string[];
  customerMatch?: string | null;
  createdCustomerId?: string | null;
}

interface Recorder {
  upserts: Array<{ table: string; payload: Record<string, unknown> }>;
  notes: Array<Record<string, unknown>>;
  contactInserts: Array<Record<string, unknown>>;
}

// PostgREST query-builder double. Intermediate methods return the builder; the
// terminal reads (.in / .limit) resolve a canned list, and .insert() returns a
// real Promise carrying .select/.single so both `await insert()` (notes) and
// `insert().select().single()` (customers) work — no object `then` needed.
interface InsertChain extends Promise<Result> {
  select: () => InsertChain;
  single: () => Promise<Result>;
}

function makeClient(config: FakeConfig): { client: AdminClient; rec: Recorder } {
  const rec: Recorder = { upserts: [], notes: [], contactInserts: [] };

  function builder(table: string) {
    function listResult(): Promise<Result> {
      if (table === 'email_messages') {
        return Promise.resolve({ data: (config.seen ?? []).map((id) => ({ gmail_msg_id: id })) });
      }
      if (table === 'customers') {
        return Promise.resolve({
          data: config.customerMatch ? [{ id: config.customerMatch }] : [],
        });
      }
      return Promise.resolve({ data: [] });
    }

    function insertResult(): Promise<Result> {
      if (table === 'customers') {
        return Promise.resolve(
          config.createdCustomerId
            ? { data: { id: config.createdCustomerId }, error: null }
            : { data: null, error: { message: 'insert_failed' } },
        );
      }
      return Promise.resolve({ data: null, error: null });
    }

    const b = {
      select: () => b,
      eq: () => b,
      is: () => b,
      ilike: () => b,
      in: () => listResult(),
      limit: () => listResult(),
      upsert: (payload: Record<string, unknown>) => {
        rec.upserts.push({ table, payload });
        return Promise.resolve({ error: null });
      },
      insert: (payload: Record<string, unknown>) => {
        if (table === 'notes') rec.notes.push(payload);
        if (table === 'customers') rec.contactInserts.push(payload);
        const chain = Promise.resolve({ error: null }) as InsertChain;
        chain.select = () => chain;
        chain.single = () => insertResult();
        return chain;
      },
    };
    return b;
  }

  return { client: { from: (t: string) => builder(t) } as unknown as AdminClient, rec };
}

function email(overrides: Partial<MappedEmail> = {}): MappedEmail {
  return {
    gmail_msg_id: 'm1',
    thread_id: 't1',
    direction: 'inbound',
    from_email: 'jane@example.com',
    from_name: 'Jane Doe',
    to_email: 'info@painlessremovals.com',
    subject: 'Quote request',
    message_id_hdr: '<a@mail>',
    in_reply_to: null,
    snippet: 'Please quote my move',
    body_text: 'Please quote my move',
    internal_date: new Date('2026-06-18T09:00:00Z').toISOString(),
    ...overrides,
  };
}

const COMPANY = '00000000-0000-0000-0000-000000000001';
const MAILBOX = 'info@painlessremovals.com';

afterEach(() => vi.clearAllMocks());

describe('ingestGmailMessages', () => {
  it('skips already-seen messages (dedup) — no upsert, no note, no notification', async () => {
    const { client, rec } = makeClient({ seen: ['m1'] });
    const res = await ingestGmailMessages(client, {
      companyId: COMPANY,
      mailbox: MAILBOX,
      messages: [email()],
    });
    expect(res).toMatchObject({ mapped: 1, skipped: 1, upserted: 0, notified: 0 });
    expect(rec.upserts).toHaveLength(0);
    expect(emitMock.emitEvent).not.toHaveBeenCalled();
  });

  it('matches an existing customer, writes a note, and notifies (inbound)', async () => {
    const { client, rec } = makeClient({ customerMatch: 'cust-1' });
    const res = await ingestGmailMessages(client, {
      companyId: COMPANY,
      mailbox: MAILBOX,
      messages: [email()],
    });
    expect(res).toMatchObject({
      matchedCustomer: 1,
      createdCustomer: 0,
      upserted: 1,
      notified: 1,
    });
    expect(rec.upserts[0]?.payload).toMatchObject({
      gmail_msg_id: 'm1',
      customer_id: 'cust-1',
      direction: 'inbound',
      source: 'gmail',
    });
    expect(rec.notes[0]).toMatchObject({
      parent_type: 'customer',
      parent_id: 'cust-1',
      category: 'admin',
    });
    expect(emitMock.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'email.received',
        companyId: COMPANY,
        linkUrl: '/dashboard/customers/cust-1',
        priority: 'normal',
      }),
    );
  });

  it('creates a contact for an unmatched inbound sender', async () => {
    const { client, rec } = makeClient({ customerMatch: null, createdCustomerId: 'new-1' });
    const res = await ingestGmailMessages(client, {
      companyId: COMPANY,
      mailbox: MAILBOX,
      messages: [email()],
    });
    expect(res).toMatchObject({ matchedCustomer: 0, createdCustomer: 1, upserted: 1, notified: 1 });
    expect(rec.contactInserts[0]).toMatchObject({
      company_id: COMPANY,
      customer_type: 'individual',
      first_name: 'Jane',
      last_name: 'Doe',
      primary_email: 'jane@example.com',
    });
    expect(rec.upserts[0]?.payload.customer_id).toBe('new-1');
  });

  it('does not create a contact or notify for outbound mail', async () => {
    const { client, rec } = makeClient({ customerMatch: null });
    const res = await ingestGmailMessages(client, {
      companyId: COMPANY,
      mailbox: MAILBOX,
      messages: [email({ direction: 'outbound', from_email: MAILBOX, from_name: 'Painless' })],
    });
    expect(res).toMatchObject({ createdCustomer: 0, notified: 0, upserted: 1 });
    expect(rec.contactInserts).toHaveLength(0);
    expect(emitMock.emitEvent).not.toHaveBeenCalled();
  });
});
