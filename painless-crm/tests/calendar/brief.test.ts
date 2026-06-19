import { type BriefInput, assembleJobBrief } from '@/lib/calendar/brief';
import { describe, expect, it } from 'vitest';

function input(over: Partial<BriefInput> = {}): BriefInput {
  return {
    kind: 'move',
    job: {
      job_number: 'PR-1234',
      stage: 'accepted',
      move_date: '2026-07-01T08:00:00.000Z',
      arrival_window: '08:00–10:00',
      customer_name: 'Smith',
      customer_phone: '07700 900123',
      notes: 'Gate code 4521',
    },
    addresses: [
      {
        role: 'to',
        sequence: 0,
        formatted: '5 Hill Rd, BS1 2AB',
        property_type: 'house',
        floor: 0,
        has_lift: null,
        has_parking: true,
        access_notes: 'driveway fits one van',
      },
      {
        role: 'from',
        sequence: 0,
        formatted: '1 Park St, BS8 1AA',
        property_type: 'flat',
        floor: 3,
        has_lift: false,
        has_parking: false,
        access_notes: 'narrow stairwell',
      },
    ],
    survey: {
      survey_type: 'in_person',
      scheduled_at: '2026-06-20T09:00:00.000Z',
      surveyor_name: 'Jay',
      cubic_ft_estimate: 850,
      notes_internal: 'Customer haggles',
      notes_for_customer: 'Please empty drawers',
    },
    cubicItems: [
      {
        room: 'Bed 1',
        item: 'Bed frame',
        quantity: 1,
        dismantle_required: true,
        reassembly_required: true,
      },
      {
        room: 'Lounge',
        item: 'Sofa',
        quantity: 1,
        dismantle_required: false,
        reassembly_required: false,
      },
    ],
    briefItems: [
      { kind: 'kit', item: 'Mattress bag', quantity: 2, notes: null },
      { kind: 'excluded', item: 'Garden shed', quantity: 1, notes: 'customer keeping' },
    ],
    notes: [
      { category: 'staff', body: 'Bring extra straps' },
      { category: 'customer_visible', body: 'We arrive 8am' },
    ],
    openTasks: [
      { title: 'Confirm parking permit', status: 'open', due_at: null },
      { title: 'Old task', status: 'done', due_at: null },
    ],
    ...over,
  };
}

describe('assembleJobBrief — crew audience', () => {
  const b = assembleJobBrief(input(), 'crew');

  it('titles by kind and customer', () => {
    expect(b.title).toBe('Move — Smith (PR-1234)');
  });
  it('uses move_date as the start for a move', () => {
    expect(b.whenStart).toBe('2026-07-01T08:00:00.000Z');
  });
  it('orders legs from → to', () => {
    expect(b.legs.map((l) => l.role)).toEqual(['from', 'to']);
  });
  it('keeps phone, access notes, kit, excluded, dismantle, reassembly, volume', () => {
    expect(b.customerPhone).toBe('07700 900123');
    expect(b.legs[0]?.access_notes).toBe('narrow stairwell');
    expect(b.kit).toHaveLength(1);
    expect(b.excluded).toHaveLength(1);
    expect(b.dismantle.map((i) => i.item)).toEqual(['Bed frame']);
    expect(b.reassembly.map((i) => i.item)).toEqual(['Bed frame']);
    expect(b.cubicEstimate).toBe(850);
  });
  it('collects internal notes (job + survey + staff) and drops done tasks', () => {
    expect(b.internalNotes).toEqual(['Gate code 4521', 'Customer haggles', 'Bring extra straps']);
    expect(b.openTasks.map((t) => t.title)).toEqual(['Confirm parking permit']);
  });
  it('surfaces customer-visible notes to both audiences', () => {
    expect(b.customerNotes).toEqual(['Please empty drawers', 'We arrive 8am']);
  });
});

describe('assembleJobBrief — customer audience strips internal data', () => {
  const b = assembleJobBrief(input(), 'customer');

  it('drops phone, kit, excluded, dismantle, tasks, volume, access notes', () => {
    expect(b.customerPhone).toBeNull();
    expect(b.kit).toEqual([]);
    expect(b.excluded).toEqual([]);
    expect(b.dismantle).toEqual([]);
    expect(b.reassembly).toEqual([]);
    expect(b.openTasks).toEqual([]);
    expect(b.cubicEstimate).toBeNull();
    expect(b.internalNotes).toEqual([]);
    expect(b.legs.every((l) => l.access_notes === null)).toBe(true);
  });
  it('still carries addresses, timing and customer notes', () => {
    expect(b.legs).toHaveLength(2);
    expect(b.whenStart).toBe('2026-07-01T08:00:00.000Z');
    expect(b.customerNotes).toContain('Please empty drawers');
  });
});

describe('assembleJobBrief — survey kind', () => {
  it('uses the survey scheduled_at, not the move date', () => {
    const b = assembleJobBrief(input({ kind: 'survey' }), 'crew');
    expect(b.title).toBe('Survey — Smith (PR-1234)');
    expect(b.whenStart).toBe('2026-06-20T09:00:00.000Z');
  });
  it('leaves whenStart null when nothing is scheduled', () => {
    const b = assembleJobBrief(input({ kind: 'survey', survey: null }), 'crew');
    expect(b.whenStart).toBeNull();
  });
});
