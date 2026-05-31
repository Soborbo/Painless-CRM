import type {
  CustomerHit,
  GlobalSearchResults,
  JobHit,
  QuoteHit,
} from '@/lib/queries/global-search';
import { buildFlatHits, moveHighlight } from '@/lib/search/keyboard';
import { describe, expect, it } from 'vitest';

function customer(id: string): CustomerHit {
  return {
    kind: 'customer',
    id,
    customer_type: 'individual',
    first_name: 'A',
    last_name: 'B',
    company_name: null,
    primary_email: null,
    primary_phone: null,
  };
}

function job(id: string): JobHit {
  return { kind: 'job', id, job_number: 'PR-1', stage: 'lead', customer: null };
}

function quote(id: string, jobId: string): QuoteHit {
  return {
    kind: 'quote',
    id,
    job_id: jobId,
    status: 'draft',
    total_pence: 0,
    created_at: '2026-01-01',
    job: null,
  };
}

function results(over: Partial<GlobalSearchResults>): GlobalSearchResults {
  return { customers: [], jobs: [], quotes: [], query: 'x', ...over };
}

describe('buildFlatHits', () => {
  it('returns an empty list when there are no hits', () => {
    expect(buildFlatHits(results({}))).toEqual([]);
  });

  it('flattens in customers → jobs → quotes order with navigation hrefs', () => {
    const flat = buildFlatHits(
      results({
        customers: [customer('c1')],
        jobs: [job('j1')],
        quotes: [quote('q1', 'j9')],
      }),
    );
    expect(flat).toEqual([
      { key: 'customer:c1', href: '/dashboard/customers/c1' },
      { key: 'job:j1', href: '/dashboard/jobs/j1' },
      { key: 'quote:q1', href: '/dashboard/jobs/j9/quote/q1' },
    ]);
  });
});

describe('moveHighlight', () => {
  it('returns -1 when there are no hits', () => {
    expect(moveHighlight(-1, 0, 1)).toBe(-1);
    expect(moveHighlight(2, 0, -1)).toBe(-1);
  });

  it('steps down from "nothing highlighted" to the first hit', () => {
    expect(moveHighlight(-1, 3, 1)).toBe(0);
  });

  it('steps within bounds', () => {
    expect(moveHighlight(0, 3, 1)).toBe(1);
    expect(moveHighlight(2, 3, -1)).toBe(1);
  });

  it('clamps at the bottom without wrapping', () => {
    expect(moveHighlight(2, 3, 1)).toBe(2);
  });

  it('clamps at the top without wrapping', () => {
    expect(moveHighlight(0, 3, -1)).toBe(0);
  });
});
