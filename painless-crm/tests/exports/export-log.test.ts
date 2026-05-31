import { flattenExportLogRow, summarizeFilters } from '@/lib/queries/export-log';
import { describe, expect, it } from 'vitest';

describe('summarizeFilters', () => {
  it('returns an empty string for no / non-object filters', () => {
    expect(summarizeFilters({})).toBe('');
    expect(summarizeFilters(null)).toBe('');
    expect(summarizeFilters(undefined)).toBe('');
    expect(summarizeFilters(['a', 'b'])).toBe('');
  });

  it('renders applied filters as a sorted key: value list', () => {
    expect(summarizeFilters({ search: 'smith', from: '2026-01-01' })).toBe(
      'from: 2026-01-01 · search: smith',
    );
  });

  it('drops null / undefined / empty-string values', () => {
    expect(summarizeFilters({ from: '2026-01-01', to: '', stage: null })).toBe('from: 2026-01-01');
  });

  it('stringifies non-string values', () => {
    expect(summarizeFilters({ archived: true, page: 2 })).toBe('archived: true · page: 2');
  });
});

describe('flattenExportLogRow', () => {
  it('normalises an embedded actor object', () => {
    const row = flattenExportLogRow({
      id: 7,
      exported_at: '2026-05-31T09:00:00Z',
      resource: 'customers',
      format: 'csv',
      row_count: 42,
      ip_address: '203.0.113.7',
      filters: { search: 'smith' },
      actor: { full_name: 'Tamar Rep', email: 'tamar@example.com' },
    });
    expect(row).toEqual({
      id: 7,
      exported_at: '2026-05-31T09:00:00Z',
      resource: 'customers',
      format: 'csv',
      row_count: 42,
      ip_address: '203.0.113.7',
      actor_name: 'Tamar Rep',
      actor_email: 'tamar@example.com',
      filters: { search: 'smith' },
    });
  });

  it('takes the first element when the actor embed arrives as an array', () => {
    const row = flattenExportLogRow({
      id: 1,
      exported_at: '2026-05-31T09:00:00Z',
      resource: 'jobs',
      format: 'csv',
      row_count: 3,
      ip_address: null,
      filters: {},
      actor: [{ full_name: 'A', email: 'a@b.c' }],
    });
    expect(row.actor_name).toBe('A');
    expect(row.actor_email).toBe('a@b.c');
  });

  it('tolerates a missing actor, ip and filters', () => {
    const row = flattenExportLogRow({
      id: 2,
      exported_at: '2026-05-31T09:00:00Z',
      resource: 'profit',
      format: 'csv',
      row_count: 0,
      ip_address: null,
      filters: null,
      actor: null,
    });
    expect(row.actor_name).toBeNull();
    expect(row.actor_email).toBeNull();
    expect(row.ip_address).toBeNull();
    expect(row.filters).toEqual({});
  });

  it('coerces a non-string inet value to a string', () => {
    const row = flattenExportLogRow({
      id: 3,
      exported_at: '2026-05-31T09:00:00Z',
      resource: 'quotes',
      format: 'xlsx',
      row_count: 9,
      ip_address: '198.51.100.4',
      filters: {},
      actor: undefined,
    });
    expect(row.ip_address).toBe('198.51.100.4');
    expect(row.format).toBe('xlsx');
  });
});
