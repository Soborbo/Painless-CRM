import { describe, expect, it } from 'vitest';
import {
  classifyCustomerType,
  customerDedupKey,
  normalizeEmail,
  normalizePhone,
  normalizeText,
  splitName,
} from '@/lib/migration/normalize';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Jay@Painless.CO.uk ')).toBe('jay@painless.co.uk');
  });
  it('returns null for blank or missing input', () => {
    expect(normalizeEmail('   ')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('converts a UK national number to E.164', () => {
    expect(normalizePhone('0117 911 5000')).toBe('+441179115000');
  });
  it('handles a +44 number with spaces and a (0)', () => {
    expect(normalizePhone('+44 (0)7700 900123')).toBe('+447700900123');
  });
  it('handles a 0044 prefix', () => {
    expect(normalizePhone('0044 7700 900123')).toBe('+447700900123');
  });
  it('handles a bare 44 prefix and strips the trunk zero', () => {
    expect(normalizePhone('447700900123')).toBe('+447700900123');
  });
  it('returns null when there are no digits', () => {
    expect(normalizePhone('n/a')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe('classifyCustomerType', () => {
  it('honours an explicit B2B/B2C type', () => {
    expect(classifyCustomerType({ explicitType: 'B2B' })).toBe('business');
    expect(classifyCustomerType({ explicitType: 'b2c' })).toBe('individual');
  });
  it('honours an explicit business/individual type', () => {
    expect(classifyCustomerType({ explicitType: 'business' })).toBe('business');
  });
  it('infers business from a company name', () => {
    expect(classifyCustomerType({ companyName: 'Relish HQ' })).toBe('business');
  });
  it('infers business from a company indicator in the name', () => {
    expect(classifyCustomerType({ customerName: 'Acme Lettings' })).toBe('business');
  });
  it('defaults to individual', () => {
    expect(classifyCustomerType({ customerName: 'Jane Doe' })).toBe('individual');
  });
});

describe('splitName', () => {
  it('splits forename and surname', () => {
    expect(splitName('Jane Doe')).toEqual({ first_name: 'Jane', last_name: 'Doe' });
  });
  it('keeps multi-part forenames, last token is surname', () => {
    expect(splitName('Mary Jane Watson')).toEqual({ first_name: 'Mary Jane', last_name: 'Watson' });
  });
  it('puts a single token in first_name with null surname', () => {
    expect(splitName('Cher')).toEqual({ first_name: 'Cher', last_name: null });
  });
  it('returns both null for blank', () => {
    expect(splitName('  ')).toEqual({ first_name: null, last_name: null });
  });
});

describe('customerDedupKey', () => {
  it('prefers email', () => {
    expect(customerDedupKey({ email: 'A@B.com', phone: '0117 911 5000' })).toBe('email:a@b.com');
  });
  it('falls back to phone when no email', () => {
    expect(customerDedupKey({ phone: '0117 911 5000' })).toBe('phone:+441179115000');
  });
  it('returns null when neither is present', () => {
    expect(customerDedupKey({})).toBeNull();
  });
});

describe('normalizeText', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeText('  hello   world ')).toBe('hello world');
  });
  it('returns null for blank', () => {
    expect(normalizeText('')).toBeNull();
  });
});
