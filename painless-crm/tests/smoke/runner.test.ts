import { runAllSmokeTests } from '@/lib/smoke/runner';
import { describe, expect, it } from 'vitest';

describe('smoke runner', () => {
  it('returns one result per registered test', async () => {
    const results = await runAllSmokeTests();
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(['excel', 'image', 'pdf', 'realtime']);
  });

  it('every result has a status from the allowed set', async () => {
    const allowed = new Set(['pending', 'running', 'pass', 'fail', 'partial']);
    const results = await runAllSmokeTests();
    for (const r of results) {
      expect(allowed.has(r.status)).toBe(true);
      expect(typeof r.note).toBe('string');
    }
  });
});
