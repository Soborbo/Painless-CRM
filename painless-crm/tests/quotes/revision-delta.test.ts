import { computeRevisionDeltas } from '@/lib/quotes/revision-delta';
import { describe, expect, it } from 'vitest';

describe('computeRevisionDeltas', () => {
  it('annotates a non-revision quote with null delta', () => {
    const out = computeRevisionDeltas([{ id: 'a', total_pence: 10000, revised_from_id: null }]);
    expect(out).toEqual([
      { row: { id: 'a', total_pence: 10000, revised_from_id: null }, delta_pence: null },
    ]);
  });

  it('computes a positive delta when the revision raised the price', () => {
    const out = computeRevisionDeltas([
      { id: 'b', total_pence: 12500, revised_from_id: 'a' },
      { id: 'a', total_pence: 10000, revised_from_id: null },
    ]);
    const b = out.find((q) => q.row.id === 'b');
    expect(b?.delta_pence).toBe(2500);
  });

  it('computes a negative delta when the revision lowered the price', () => {
    const out = computeRevisionDeltas([
      { id: 'b', total_pence: 8000, revised_from_id: 'a' },
      { id: 'a', total_pence: 10000, revised_from_id: null },
    ]);
    const b = out.find((q) => q.row.id === 'b');
    expect(b?.delta_pence).toBe(-2000);
  });

  it('emits 0 when the revision left the price unchanged', () => {
    const out = computeRevisionDeltas([
      { id: 'b', total_pence: 10000, revised_from_id: 'a' },
      { id: 'a', total_pence: 10000, revised_from_id: null },
    ]);
    const b = out.find((q) => q.row.id === 'b');
    expect(b?.delta_pence).toBe(0);
  });

  it('walks chains one step at a time (each revision compares to its immediate parent)', () => {
    const out = computeRevisionDeltas([
      { id: 'c', total_pence: 13000, revised_from_id: 'b' },
      { id: 'b', total_pence: 12000, revised_from_id: 'a' },
      { id: 'a', total_pence: 10000, revised_from_id: null },
    ]);
    expect(out.find((q) => q.row.id === 'a')?.delta_pence).toBeNull();
    expect(out.find((q) => q.row.id === 'b')?.delta_pence).toBe(2000);
    expect(out.find((q) => q.row.id === 'c')?.delta_pence).toBe(1000);
  });

  it('returns null when the predecessor is missing from the input list', () => {
    const out = computeRevisionDeltas([{ id: 'b', total_pence: 12000, revised_from_id: 'orphan' }]);
    expect(out[0]?.delta_pence).toBeNull();
  });

  it('preserves input order so the renderer can iterate verbatim', () => {
    const rows = [
      { id: 'b', total_pence: 12000, revised_from_id: 'a' },
      { id: 'a', total_pence: 10000, revised_from_id: null },
    ];
    const out = computeRevisionDeltas(rows);
    expect(out.map((q) => q.row.id)).toEqual(['b', 'a']);
  });
});
