import {
  type CustomFieldDef,
  CustomFieldDefSchema,
  parseDefs,
  readValues,
  validateValues,
} from '@/lib/custom-fields/defs';
import { describe, expect, it } from 'vitest';

describe('CustomFieldDefSchema', () => {
  it('accepts a valid text field', () => {
    expect(
      CustomFieldDefSchema.safeParse({ key: 'access_code', label: 'Access code', type: 'text' })
        .success,
    ).toBe(true);
  });
  it('rejects a bad key', () => {
    expect(
      CustomFieldDefSchema.safeParse({ key: 'Access Code', label: 'x', type: 'text' }).success,
    ).toBe(false);
    expect(CustomFieldDefSchema.safeParse({ key: '1abc', label: 'x', type: 'text' }).success).toBe(
      false,
    );
  });
  it('requires options for a select field', () => {
    expect(CustomFieldDefSchema.safeParse({ key: 'k', label: 'L', type: 'select' }).success).toBe(
      false,
    );
    expect(
      CustomFieldDefSchema.safeParse({ key: 'k', label: 'L', type: 'select', options: ['a', 'b'] })
        .success,
    ).toBe(true);
  });
});

describe('parseDefs', () => {
  it('keeps valid defs, drops malformed ones, dedupes by key', () => {
    const defs = parseDefs([
      { key: 'a', label: 'A', type: 'text' },
      { key: 'BAD KEY', label: 'X', type: 'text' },
      { key: 'a', label: 'dup', type: 'text' },
      { key: 'b', label: 'B', type: 'number' },
    ]);
    expect(defs.map((d) => d.key)).toEqual(['a', 'b']);
  });
  it('returns [] for non-array / junk', () => {
    expect(parseDefs(null)).toEqual([]);
    expect(parseDefs('nope')).toEqual([]);
    expect(parseDefs(undefined)).toEqual([]);
  });
});

const DEFS: CustomFieldDef[] = [
  { key: 'code', label: 'Access code', type: 'text', required: true },
  { key: 'floors', label: 'Floors', type: 'number' },
  { key: 'parking', label: 'Parking', type: 'select', options: ['yes', 'no'] },
  { key: 'fragile', label: 'Fragile', type: 'checkbox' },
];

describe('validateValues', () => {
  it('coerces by type and ignores unknown keys', () => {
    const { values, errors } = validateValues(DEFS, {
      code: ' A12 ',
      floors: '3',
      parking: 'yes',
      fragile: 'on',
      ghost: 'ignored',
    });
    expect(errors).toEqual({});
    expect(values).toEqual({ code: 'A12', floors: 3, parking: 'yes', fragile: true });
    expect('ghost' in values).toBe(false);
  });

  it('flags a missing required field and omits empty optional ones', () => {
    const { values, errors } = validateValues(DEFS, { code: '', floors: '' });
    expect(errors.code).toMatch(/required/i);
    expect('floors' in values).toBe(false);
  });

  it('rejects a non-number and an out-of-list select', () => {
    const r = validateValues(DEFS, { code: 'x', floors: 'abc', parking: 'maybe' });
    expect(r.errors.floors).toBeTruthy();
    expect(r.errors.parking).toBeTruthy();
  });

  it('checkbox is always present as a boolean', () => {
    expect(validateValues(DEFS, { code: 'x', fragile: '' }).values.fragile).toBe(false);
    expect(validateValues(DEFS, { code: 'x', fragile: 'true' }).values.fragile).toBe(true);
  });
});

describe('readValues', () => {
  it('keeps only primitive scalar values', () => {
    expect(readValues({ a: 'x', b: 3, c: true, d: { nested: 1 }, e: [1] })).toEqual({
      a: 'x',
      b: 3,
      c: true,
    });
  });
  it('returns {} for junk', () => {
    expect(readValues(null)).toEqual({});
    expect(readValues([1, 2])).toEqual({});
  });
});
