import { verifyHmac } from '@/lib/webhooks/handler';
import {
  buildCmmAddresses,
  buildCmmIntakeDetails,
  buildCmmNotes,
  cmmFullName,
  mapCmmServiceType,
} from '@/lib/webhooks/compare-my-move';
import {
  CmmResultSchema,
  cmmEnvelope,
  cmmSignedString,
} from '@/lib/webhooks/compare-my-move-schema';
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

// The three result objects from CMM's webhook docs (verbatim shapes).
const residential = {
  lead_type: 'residential',
  quote_id: 'TES-1670326629',
  first_name: 'Test',
  surname: 'Customer',
  customer_name: 'Test Customer',
  email: 'test@test.com',
  phone: '07777777777',
  cancelled: 'No',
  created_at: '2025-02-28 15:00:00',
  current_address_line_1: '123 Contact Street',
  current_address_line_2: null,
  current_town: 'Test Town',
  current_county: null,
  current_postcode: 'ZZ1 1ZZ',
  current_udprn: '13572468',
  current_bedrooms: 3,
  current_storage_size: '75 - 100 sq ft',
  current_lift: null,
  current_floor_level: null,
  current_type: 'House',
  new_address_line_1: '123 New Street',
  new_town: 'Test Town',
  new_postcode: 'ZZ9 9ZZ',
  new_udprn: '13572468',
  new_bedrooms: 3,
  moving_date: '2025-04-05 00:00:00',
  flexible_moving_date: 'No',
  additional_information: 'Lorem ipsum dolor sit amet',
  packing_service_required: 'Yes',
  packing_materials_required: 'Yes',
  packing_dismantling_required: 'No',
};

const smallMove = {
  ...residential,
  lead_type: 'small-move',
  current_bedrooms: null,
  van_type: 'medium-van',
  new_town: 'New Town',
  new_town_only: 'New Town',
  new_postcode: 'YY1 1YY',
};

const clearance = {
  lead_type: 'clearance',
  quote_id: 'TES-1670326630',
  first_name: 'Test',
  surname: 'Customer',
  customer_name: 'Test Customer',
  email: 'test@test.com',
  phone: '07777777777',
  cancelled: 'No',
  created_at: '2025-02-28 15:00:00',
  address_line_1: '123 Contact Street',
  town: 'Test Town',
  county: null,
  postcode: 'ZZ1 1ZZ',
  udprn: '13572468',
  size: 'Medium',
  clearance_date: 'As soon as possible',
  additional_information: 'Lorem ipsum',
};

describe('CmmResultSchema', () => {
  it('accepts all three documented lead shapes', () => {
    expect(CmmResultSchema.safeParse(residential).success).toBe(true);
    expect(CmmResultSchema.safeParse(smallMove).success).toBe(true);
    expect(CmmResultSchema.safeParse(clearance).success).toBe(true);
  });

  it('requires quote_id, email and phone', () => {
    const { quote_id: _q, ...noQuote } = residential;
    expect(CmmResultSchema.safeParse(noQuote).success).toBe(false);
    expect(CmmResultSchema.safeParse({ ...residential, email: 'nope' }).success).toBe(false);
  });

  it('preserves unforeseen split-test fields via passthrough', () => {
    const parsed = CmmResultSchema.parse({ ...residential, future_field: 'kept' });
    expect((parsed as Record<string, unknown>).future_field).toBe('kept');
  });
});

describe('cmmEnvelope', () => {
  const body = {
    result: residential,
    timestamp: 1670326629,
    token: '944e320c56ce9f985757e9150ca01c435348e673b77a95847d',
    signature: '19909342f3bdb2a0b71672f21af3e387ee7ee60b5bd4ab088a684e190050519f',
  };

  it('extracts signed string, signature and dedup id', () => {
    const env = cmmEnvelope(body);
    expect(env).not.toBeNull();
    expect(env?.signedString).toBe(`1670326629${body.token}`);
    expect(env?.signature).toBe(body.signature);
    expect(env?.eventId).toBe('TES-1670326629');
  });

  it('returns null when result or quote_id is missing', () => {
    expect(cmmEnvelope({ timestamp: 1, token: 'x', signature: 'y' })).toBeNull();
    const { quote_id: _q, ...noQuote } = residential;
    expect(cmmEnvelope({ result: noQuote })).toBeNull();
  });
});

describe('cmmSignedString', () => {
  it('concatenates timestamp and token', () => {
    expect(cmmSignedString(1670326629, 'abc')).toBe('1670326629abc');
    expect(cmmSignedString(undefined, undefined)).toBe('');
  });
});

describe('verifyHmac over the CMM signed string', () => {
  const secret = 'shared-secret-key-1234567890';
  const signed = cmmSignedString(1670326629, 'token-value');
  const oracle = createHmac('sha256', secret).update(signed).digest('hex');

  it('accepts a correctly computed signature', async () => {
    expect(await verifyHmac(secret, signed, oracle)).toBe(true);
  });

  it('rejects a tampered signature', async () => {
    expect(await verifyHmac(secret, signed, `${oracle.slice(0, -1)}0`)).toBe(false);
    expect(await verifyHmac(secret, signed, null)).toBe(false);
  });
});

describe('mapCmmServiceType', () => {
  it('maps removals lead types to service_type', () => {
    expect(mapCmmServiceType('residential')).toBe('removal');
    expect(mapCmmServiceType('small-move')).toBe('removal');
    expect(mapCmmServiceType('international')).toBe('removal');
    expect(mapCmmServiceType('clearance')).toBe('waste_clearance');
    expect(mapCmmServiceType('mystery')).toBeUndefined();
  });
});

describe('cmmFullName', () => {
  it('prefers customer_name, then first+surname, then email', () => {
    expect(cmmFullName(CmmResultSchema.parse(residential))).toBe('Test Customer');
    const noName = CmmResultSchema.parse({ ...residential, customer_name: null });
    expect(cmmFullName(noName)).toBe('Test Customer');
    const surnameless = CmmResultSchema.parse({
      ...residential,
      customer_name: null,
      surname: null,
    });
    expect(cmmFullName(surnameless)).toBe('Test');
    const anon = CmmResultSchema.parse({
      ...residential,
      customer_name: null,
      first_name: null,
      surname: null,
    });
    expect(cmmFullName(anon)).toBe('test@test.com');
  });
});

describe('buildCmmAddresses', () => {
  it('residential carries current → new with access metadata', () => {
    const { from, to } = buildCmmAddresses(CmmResultSchema.parse(residential));
    expect(from?.postcode).toBe('ZZ1 1ZZ');
    expect(from?.line1).toBe('123 Contact Street');
    expect(from?.property_type).toBe('House');
    expect(to?.postcode).toBe('ZZ9 9ZZ');
    expect(to?.city).toBe('Test Town');
  });

  it('small-move falls back to new_town_only for the destination city', () => {
    const { to } = buildCmmAddresses(CmmResultSchema.parse(smallMove));
    expect(to?.postcode).toBe('YY1 1YY');
    expect(to?.city).toBe('New Town');
  });

  it('clearance is a single from leg with no destination', () => {
    const { from, to } = buildCmmAddresses(CmmResultSchema.parse(clearance));
    expect(from?.postcode).toBe('ZZ1 1ZZ');
    expect(to).toBeUndefined();
  });

  it('maps lift and floor when the move is from a flat', () => {
    const flat = CmmResultSchema.parse({
      ...residential,
      current_type: 'Flat',
      current_lift: 'Yes',
      current_floor_level: 3,
    });
    const { from } = buildCmmAddresses(flat);
    expect(from?.has_lift).toBe(true);
    expect(from?.floor).toBe(3);
  });
});

describe('buildCmmNotes', () => {
  it('summarises packing, additional info and a cancellation warning', () => {
    const notes = buildCmmNotes(CmmResultSchema.parse(residential));
    expect(notes).toContain('Lorem ipsum');
    expect(notes).toContain('Packing services: packing, materials');
    expect(notes).not.toContain('CANCELLED');

    const cancelled = buildCmmNotes(CmmResultSchema.parse({ ...residential, cancelled: 'Yes' }));
    expect(cancelled).toContain('CANCELLED');
  });

  it('includes van type and clearance details when present', () => {
    expect(buildCmmNotes(CmmResultSchema.parse(smallMove))).toContain('Van requested: medium-van');
    const cn = buildCmmNotes(CmmResultSchema.parse(clearance));
    expect(cn).toContain('Clearance size: Medium');
    expect(cn).toContain('As soon as possible');
  });
});

describe('buildCmmIntakeDetails', () => {
  it('namespaces under compare_my_move and prunes nulls, coercing bedrooms', () => {
    const details = buildCmmIntakeDetails(CmmResultSchema.parse(residential));
    const cmm = details.compare_my_move as Record<string, unknown>;
    expect(cmm.quote_id).toBe('TES-1670326629');
    expect(cmm.current_bedrooms).toBe(3);
    expect(cmm.current_storage_size).toBe('75 - 100 sq ft');
    expect('current_county' in cmm).toBe(false); // null was pruned
  });
});
