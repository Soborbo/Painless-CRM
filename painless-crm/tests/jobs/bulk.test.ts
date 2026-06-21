import { BULK_JOB_LIMIT, normalizeJobIds } from '@/lib/jobs/bulk';
import { describe, expect, it } from 'vitest';

describe('normalizeJobIds', () => {
  it('trims, drops blanks and de-duplicates while preserving order', () => {
    expect(normalizeJobIds(['  a ', 'b', '', '  ', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array for no usable ids', () => {
    expect(normalizeJobIds(['', '   '])).toEqual([]);
    expect(normalizeJobIds([])).toEqual([]);
  });

  it('exposes a sane batch cap', () => {
    expect(BULK_JOB_LIMIT).toBe(200);
  });
});
