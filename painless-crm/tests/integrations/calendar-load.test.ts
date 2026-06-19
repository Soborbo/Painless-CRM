import { buildEntityEvent, formatAddress } from '@/lib/integrations/google-calendar/load';
import type { createAdminClient } from '@/lib/supabase/admin';
import { describe, expect, it } from 'vitest';

type AdminClient = ReturnType<typeof createAdminClient>;

// PostgREST query-builder double. The builder IS a real Promise (so `await`
// resolves the table's list), with chainable methods attached that return it;
// maybeSingle resolves the table's single row. Data is routed per table.
interface QB extends Promise<{ data: unknown }> {
  select: (...a: unknown[]) => QB;
  eq: (...a: unknown[]) => QB;
  is: (...a: unknown[]) => QB;
  in: (...a: unknown[]) => QB;
  order: (...a: unknown[]) => QB;
  limit: (...a: unknown[]) => QB;
  maybeSingle: () => Promise<{ data: unknown }>;
}

type TableData = Record<string, { single?: unknown; list?: unknown[] }>;

function makeClient(tables: TableData): AdminClient {
  function builder(table: string): QB {
    const data = tables[table] ?? {};
    const b = Promise.resolve({ data: data.list ?? [] }) as unknown as QB;
    b.select = () => b;
    b.eq = () => b;
    b.is = () => b;
    b.in = () => b;
    b.order = () => b;
    b.limit = () => b;
    b.maybeSingle = () => Promise.resolve({ data: data.single ?? null });
    return b;
  }
  return { from: (t: string) => builder(t) } as unknown as AdminClient;
}

const CUSTOMER = {
  first_name: 'Jane',
  last_name: 'Smith',
  company_name: null,
  primary_phone: '07700 900123',
};
const SURVEY = {
  id: 'sv1',
  job_id: 'job-1',
  survey_type: 'in_person',
  scheduled_at: '2026-06-20T09:00:00.000Z',
  cubic_ft_estimate: 850,
  notes_internal: 'haggles',
  notes_for_customer: 'empty drawers',
};
const ADDRESSES = [
  {
    role: 'from',
    sequence: 0,
    property_type: 'flat',
    floor: 3,
    has_lift: false,
    has_parking: false,
    access_notes: 'narrow stairwell',
    address: { line1: '1 Park St', line2: null, city: 'Bristol', postcode: 'BS8 1AA' },
  },
  {
    role: 'to',
    sequence: 0,
    property_type: 'house',
    floor: 0,
    has_lift: null,
    has_parking: true,
    access_notes: null,
    address: { line1: '5 Hill Rd', line2: null, city: 'Bristol', postcode: 'BS1 2AB' },
  },
];

function fullTables(
  stage = 'accepted',
  moveDate: string | null = '2026-07-01T08:00:00.000Z',
): TableData {
  return {
    jobs: {
      single: {
        job_number: 'PR-1234',
        stage,
        move_date: moveDate,
        arrival_window: '08:00–10:00',
        notes: 'Gate code 4521',
        customer: CUSTOMER,
      },
    },
    surveys: { single: SURVEY },
    job_addresses: { list: ADDRESSES },
    cubic_sheet_items: {
      list: [
        {
          room: 'Bed 1',
          item: 'Bed frame',
          quantity: 1,
          dismantle_required: true,
          reassembly_required: true,
        },
      ],
    },
    job_brief_items: { list: [{ kind: 'kit', item: 'Mattress bag', quantity: 2, notes: null }] },
    notes: { list: [{ category: 'staff', body: 'Bring straps' }] },
    tasks: { list: [{ title: 'Confirm parking', status: 'open', due_at: null }] },
  };
}

describe('formatAddress', () => {
  it('joins the present parts, skipping blanks', () => {
    expect(
      formatAddress({ line1: '1 Park St', line2: null, city: 'Bristol', postcode: 'BS8 1AA' }),
    ).toBe('1 Park St, Bristol, BS8 1AA');
    expect(formatAddress(null)).toBe('');
  });
});

describe('buildEntityEvent — job_move', () => {
  it('builds the move event from the joined rows', async () => {
    const ev = await buildEntityEvent(makeClient(fullTables()), 'job_move', 'job-1');
    expect(ev?.summary).toBe('Move — Jane Smith (PR-1234)');
    expect(ev?.location).toBe('1 Park St, Bristol, BS8 1AA');
    expect(ev?.start.dateTime).toBe('2026-07-01T08:00:00.000Z');
    expect(ev?.description).toContain('☎ Jane Smith — 07700 900123');
    expect(ev?.description).toContain('2× Mattress bag');
    expect(ev?.description).toContain('access: narrow stairwell');
  });

  it('returns null for a cancelled job (→ delete)', async () => {
    const ev = await buildEntityEvent(makeClient(fullTables('cancelled')), 'job_move', 'job-1');
    expect(ev).toBeNull();
  });

  it('returns null when there is no move date yet', async () => {
    const ev = await buildEntityEvent(
      makeClient(fullTables('accepted', null)),
      'job_move',
      'job-1',
    );
    expect(ev).toBeNull();
  });
});

describe('buildEntityEvent — survey', () => {
  it('builds the survey event from the survey scheduled_at', async () => {
    const ev = await buildEntityEvent(makeClient(fullTables()), 'survey', 'sv1');
    expect(ev?.summary).toBe('Survey — Jane Smith (PR-1234)');
    expect(ev?.start.dateTime).toBe('2026-06-20T09:00:00.000Z');
  });

  it('returns null when the survey is not scheduled', async () => {
    const tables = { surveys: { single: { ...SURVEY, scheduled_at: null } } };
    expect(await buildEntityEvent(makeClient(tables), 'survey', 'sv1')).toBeNull();
  });
});
