import type { JobBrief } from '@/lib/calendar/brief';
import { DEFAULT_TIME_ZONE, briefToDescription, briefToGoogleEvent } from '@/lib/calendar/event';
import { describe, expect, it } from 'vitest';

function brief(over: Partial<JobBrief> = {}): JobBrief {
  return {
    audience: 'crew',
    kind: 'move',
    jobNumber: 'PR-1234',
    title: 'Move — Smith (PR-1234)',
    customerName: 'Smith',
    customerPhone: '07700 900123',
    whenStart: '2026-07-01T08:00:00.000Z',
    arrivalWindow: '08:00–10:00',
    legs: [
      {
        role: 'from',
        address: '1 Park St, BS8 1AA',
        property_type: 'flat',
        floor: 3,
        has_lift: false,
        has_parking: false,
        access_notes: 'narrow stairwell',
      },
      {
        role: 'to',
        address: '5 Hill Rd, BS1 2AB',
        property_type: 'house',
        floor: 0,
        has_lift: null,
        has_parking: true,
        access_notes: null,
      },
    ],
    dismantle: [
      {
        room: 'Bed 1',
        item: 'Bed frame',
        quantity: 1,
        dismantle_required: true,
        reassembly_required: true,
      },
    ],
    reassembly: [
      {
        room: 'Bed 1',
        item: 'Bed frame',
        quantity: 1,
        dismantle_required: true,
        reassembly_required: true,
      },
    ],
    kit: [{ kind: 'kit', item: 'Mattress bag', quantity: 2, notes: null }],
    excluded: [{ kind: 'excluded', item: 'Garden shed', quantity: 1, notes: 'customer keeping' }],
    internalNotes: ['Gate code 4521'],
    customerNotes: ['Please empty drawers'],
    openTasks: [{ title: 'Confirm parking permit', status: 'open', due_at: null }],
    cubicEstimate: 850,
    ...over,
  };
}

const OPTS = { entityType: 'job_move' as const, entityId: 'job-1' };

describe('briefToGoogleEvent', () => {
  it('maps summary, location (the from leg) and the back-reference', () => {
    const ev = briefToGoogleEvent(brief(), OPTS);
    expect(ev?.summary).toBe('Move — Smith (PR-1234)');
    expect(ev?.location).toBe('1 Park St, BS8 1AA');
    expect(ev?.extendedProperties.private.crm_entity).toBe('job_move:job-1');
  });
  it('derives end from the default duration per kind (move = 240m)', () => {
    const ev = briefToGoogleEvent(brief(), OPTS);
    expect(ev?.start.dateTime).toBe('2026-07-01T08:00:00.000Z');
    expect(ev?.end.dateTime).toBe('2026-07-01T12:00:00.000Z');
    expect(ev?.start.timeZone).toBe(DEFAULT_TIME_ZONE);
  });
  it('honours an explicit duration and time zone', () => {
    const ev = briefToGoogleEvent(brief(), { ...OPTS, durationMinutes: 90, timeZone: 'UTC' });
    expect(ev?.end.dateTime).toBe('2026-07-01T09:30:00.000Z');
    expect(ev?.start.timeZone).toBe('UTC');
  });
  it('uses a 60m default for a survey', () => {
    const ev = briefToGoogleEvent(brief({ kind: 'survey' }), { ...OPTS, entityType: 'survey' });
    expect(ev?.end.dateTime).toBe('2026-07-01T09:00:00.000Z');
  });
  it('returns null when the entity has no scheduled time', () => {
    expect(briefToGoogleEvent(brief({ whenStart: null }), OPTS)).toBeNull();
  });
});

describe('briefToDescription', () => {
  it('renders the full crew brief', () => {
    const d = briefToDescription(brief());
    expect(d).toContain('☎ Smith — 07700 900123');
    expect(d).toContain('Arrival: 08:00–10:00');
    expect(d).toContain('FROM: 1 Park St, BS8 1AA (flat, floor 3, no lift, no parking)');
    expect(d).toContain('access: narrow stairwell');
    expect(d).toContain('Kit to bring:');
    expect(d).toContain('2× Mattress bag');
    expect(d).toContain('NOT going:');
    expect(d).toContain('1× Garden shed — customer keeping');
    expect(d).toContain('Est. volume: 850 cu ft');
    expect(d).toContain('Gate code 4521');
  });
  it('omits internal sections for a customer-shaped brief', () => {
    const d = briefToDescription(
      brief({
        customerPhone: null,
        kit: [],
        excluded: [],
        dismantle: [],
        reassembly: [],
        openTasks: [],
        cubicEstimate: null,
        internalNotes: [],
        legs: [
          {
            role: 'to',
            address: '5 Hill Rd, BS1 2AB',
            property_type: null,
            floor: null,
            has_lift: null,
            has_parking: null,
            access_notes: null,
          },
        ],
      }),
    );
    expect(d).not.toContain('Kit to bring:');
    expect(d).not.toContain('NOT going:');
    expect(d).not.toContain('☎');
    expect(d).not.toContain('access:');
    expect(d).toContain('Customer notes:');
    expect(d).toContain('Please empty drawers');
  });
});
