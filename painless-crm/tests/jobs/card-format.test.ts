import {
  type JobAddressSummary,
  addressLine,
  pickMoveEndpoints,
  whatsappHref,
} from '@/lib/jobs/card-format';
import { describe, expect, it } from 'vitest';

function addr(over: Partial<JobAddressSummary>): JobAddressSummary {
  return {
    job_id: 'j1',
    role: 'from',
    line1: '8 Bude Rd',
    line2: null,
    city: 'Filton',
    postcode: 'BS34 7HN',
    property_type: 'house',
    floor: 1,
    has_lift: false,
    ...over,
  };
}

describe('addressLine', () => {
  it('joins line1, city and postcode', () => {
    expect(addressLine(addr({}))).toBe('8 Bude Rd, Filton, BS34 7HN');
  });

  it('includes line2 when present and skips blanks', () => {
    expect(addressLine(addr({ line2: 'Flat 2' }))).toBe('8 Bude Rd, Flat 2, Filton, BS34 7HN');
    expect(addressLine(addr({ line2: '  ' }))).toBe('8 Bude Rd, Filton, BS34 7HN');
  });

  it('dedupes a city repeated across parts case-insensitively', () => {
    expect(addressLine(addr({ line2: 'filton' }))).toBe('8 Bude Rd, filton, BS34 7HN');
  });
});

describe('whatsappHref', () => {
  it('passes E.164 numbers through as digits', () => {
    expect(whatsappHref('+447742508567')).toBe('https://wa.me/447742508567');
  });

  it('converts UK national format to 44', () => {
    expect(whatsappHref('07480 371236')).toBe('https://wa.me/447480371236');
  });

  it('converts 00-prefixed international format', () => {
    expect(whatsappHref('0044 7480 371236')).toBe('https://wa.me/447480371236');
  });

  it('rejects null, empty and too-short numbers', () => {
    expect(whatsappHref(null)).toBeNull();
    expect(whatsappHref(undefined)).toBeNull();
    expect(whatsappHref('')).toBeNull();
    expect(whatsappHref('12345')).toBeNull();
  });
});

describe('pickMoveEndpoints', () => {
  it('picks the first from/to and ignores via', () => {
    const rows = [
      addr({ role: 'via', line1: 'Via St' }),
      addr({ role: 'from', line1: 'First From' }),
      addr({ role: 'from', line1: 'Second From' }),
      addr({ role: 'to', line1: 'To St' }),
    ];
    const { from, to } = pickMoveEndpoints(rows);
    expect(from?.line1).toBe('First From');
    expect(to?.line1).toBe('To St');
  });

  it('returns nulls for an empty list', () => {
    expect(pickMoveEndpoints([])).toEqual({ from: null, to: null });
  });
});
