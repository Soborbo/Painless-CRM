import {
  type DigestManager,
  type OverdueLeadForDigest,
  buildCompanyDigests,
  composeDigestText,
  minutesOverdue,
} from '@/lib/jobs/sla-digest';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-05-31T09:00:00.000Z');
const CO_A = '00000000-0000-0000-0000-0000000000a1';
const CO_B = '00000000-0000-0000-0000-0000000000b2';

function lead(over: Partial<OverdueLeadForDigest> = {}): OverdueLeadForDigest {
  return {
    job_id: 'j1',
    job_number: 'J2026-00001',
    company_id: CO_A,
    acquisition_source: 'website',
    first_response_due_at: '2026-05-31T08:30:00.000Z',
    customer_name: 'Mary Smith',
    assigned_to_name: 'Pete',
    ...over,
  };
}

describe('minutesOverdue', () => {
  it('floors the whole minutes past the deadline', () => {
    expect(minutesOverdue('2026-05-31T08:30:00.000Z', NOW)).toBe(30);
    expect(minutesOverdue('2026-05-31T08:58:30.000Z', NOW)).toBe(1);
  });

  it('clamps to zero for a not-yet-overdue deadline', () => {
    expect(minutesOverdue('2026-05-31T09:30:00.000Z', NOW)).toBe(0);
  });
});

describe('composeDigestText', () => {
  it('sorts leads oldest-deadline first and counts them', () => {
    const text = composeDigestText(
      [
        lead({ job_number: 'J-newer', first_response_due_at: '2026-05-31T08:50:00.000Z' }),
        lead({ job_number: 'J-older', first_response_due_at: '2026-05-31T08:00:00.000Z' }),
      ],
      NOW,
    );
    expect(text).toContain('2 leads are past');
    expect(text.indexOf('J-older')).toBeLessThan(text.indexOf('J-newer'));
  });

  it('renders unassigned leads and unknown source gracefully', () => {
    const text = composeDigestText(
      [lead({ assigned_to_name: null, acquisition_source: null })],
      NOW,
    );
    expect(text).toContain('Unassigned');
    expect(text).toContain('unknown source');
    expect(text).toContain('1 lead are past'); // singular count word
  });
});

describe('buildCompanyDigests', () => {
  const managers: DigestManager[] = [
    { company_id: CO_A, email: 'a-mgr@example.com' },
    { company_id: CO_A, email: 'a-admin@example.com' },
    { company_id: CO_B, email: 'b-mgr@example.com' },
  ];

  it('groups leads per company and pairs them with that company recipients', () => {
    const digests = buildCompanyDigests(
      [
        lead({ company_id: CO_A }),
        lead({ company_id: CO_A, job_number: 'J-2' }),
        lead({ company_id: CO_B }),
      ],
      managers,
      NOW,
    );
    const a = digests.find((d) => d.companyId === CO_A);
    const b = digests.find((d) => d.companyId === CO_B);
    expect(a?.recipients).toEqual(['a-mgr@example.com', 'a-admin@example.com']);
    expect(a?.leadCount).toBe(2);
    expect(a?.subject).toBe('2 leads past SLA');
    expect(b?.leadCount).toBe(1);
    expect(b?.subject).toBe('1 lead past SLA');
  });

  it('drops companies that have overdue leads but no reachable manager', () => {
    const digests = buildCompanyDigests(
      [lead({ company_id: CO_B })],
      [{ company_id: CO_A, email: 'x@y.com' }],
      NOW,
    );
    expect(digests).toHaveLength(0);
  });

  it('dedupes recipient emails and ignores blank ones', () => {
    const digests = buildCompanyDigests(
      [lead({ company_id: CO_A })],
      [
        { company_id: CO_A, email: 'dup@example.com' },
        { company_id: CO_A, email: 'dup@example.com' },
        { company_id: CO_A, email: '' },
      ],
      NOW,
    );
    expect(digests[0]?.recipients).toEqual(['dup@example.com']);
  });

  it('returns nothing when there are no overdue leads', () => {
    expect(buildCompanyDigests([], managers, NOW)).toEqual([]);
  });
});
