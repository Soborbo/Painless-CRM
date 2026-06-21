import {
  type DedupCustomer,
  findDuplicateClusters,
  normalizeEmail,
  normalizePhone,
} from '@/lib/customers/duplicates';
import { describe, expect, it } from 'vitest';

function cust(p: Partial<DedupCustomer> & { id: string }): DedupCustomer {
  return {
    customer_type: 'individual',
    first_name: 'Test',
    last_name: 'User',
    company_name: null,
    primary_email: null,
    primary_phone: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...p,
  };
}

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Jo@Example.COM ')).toBe('jo@example.com');
  });
  it('rejects values without an @', () => {
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('keys UK numbers the same across formats', () => {
    expect(normalizePhone('+44 7911 123456')).toBe('7911123456');
    expect(normalizePhone('07911 123456')).toBe('7911123456');
    expect(normalizePhone('447911123456')).toBe('7911123456');
  });
  it('returns null for too-short or empty input', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe('findDuplicateClusters', () => {
  it('groups customers sharing an email', () => {
    const clusters = findDuplicateClusters([
      cust({ id: 'a', primary_email: 'jo@example.com' }),
      cust({ id: 'b', primary_email: 'JO@example.com' }),
      cust({ id: 'c', primary_email: 'other@example.com' }),
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.customers.map((c) => c.id)).toEqual(['a', 'b']);
    expect(clusters[0]?.matchedOn).toEqual(['email']);
  });

  it('links transitively across email and phone', () => {
    const clusters = findDuplicateClusters([
      cust({ id: 'a', primary_email: 'x@e.com' }),
      cust({ id: 'b', primary_email: 'x@e.com', primary_phone: '07911 123456' }),
      cust({ id: 'c', primary_phone: '+447911123456' }),
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.customers.map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
    expect(clusters[0]?.matchedOn.sort()).toEqual(['email', 'phone']);
  });

  it('ignores singletons and unmatched details', () => {
    const clusters = findDuplicateClusters([
      cust({ id: 'a', primary_email: 'a@e.com' }),
      cust({ id: 'b', primary_phone: '07000 000111' }),
    ]);
    expect(clusters).toEqual([]);
  });

  it('orders members oldest first and clusters by size', () => {
    const clusters = findDuplicateClusters([
      cust({ id: 'big1', primary_phone: '07111 111111', created_at: '2026-03-01T00:00:00.000Z' }),
      cust({ id: 'big2', primary_phone: '07111 111111', created_at: '2026-02-01T00:00:00.000Z' }),
      cust({ id: 'big3', primary_phone: '07111 111111', created_at: '2026-01-01T00:00:00.000Z' }),
      cust({ id: 'sm1', primary_email: 'p@e.com', created_at: '2026-01-01T00:00:00.000Z' }),
      cust({ id: 'sm2', primary_email: 'p@e.com', created_at: '2026-01-02T00:00:00.000Z' }),
    ]);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]?.customers.map((c) => c.id)).toEqual(['big3', 'big2', 'big1']);
    expect(clusters[0]?.id).toBe('big3');
    expect(clusters[1]?.customers.map((c) => c.id)).toEqual(['sm1', 'sm2']);
  });

  it('returns nothing for an empty base', () => {
    expect(findDuplicateClusters([])).toEqual([]);
  });
});
