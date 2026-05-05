import { mergeJobTimeline } from '@/lib/jobs/timeline-merge';
import { describe, expect, it } from 'vitest';

describe('mergeJobTimeline', () => {
  it('produces an empty list when no source has rows', () => {
    expect(
      mergeJobTimeline({ stages: [], notes: [], calls: [], quotes: [], acceptances: [] }),
    ).toEqual([]);
  });

  it('sorts events newest-first across sources', () => {
    const out = mergeJobTimeline({
      stages: [
        {
          changed_at: '2026-05-04T10:00:00Z',
          from_stage: null,
          to_stage: 'lead',
          reason: null,
          changed_by: null,
        },
      ],
      notes: [
        {
          created_at: '2026-05-04T11:00:00Z',
          body: 'Customer was tricky',
          is_customer_visible: false,
          created_by: null,
        },
      ],
      calls: [
        {
          occurred_at: '2026-05-04T10:30:00Z',
          direction: 'outbound',
          duration_seconds: 90,
          user: null,
        },
      ],
      quotes: [],
      acceptances: [],
    });
    expect(out.map((e) => e.kind)).toEqual(['note', 'call', 'stage']);
  });

  it('emits both quote_created and quote_sent for a single sent quote', () => {
    const out = mergeJobTimeline({
      stages: [],
      notes: [],
      calls: [],
      quotes: [
        {
          id: 'q1',
          created_at: '2026-05-04T09:00:00Z',
          sent_at: '2026-05-04T09:30:00Z',
          total_pence: 12000,
          status: 'sent',
        },
      ],
      acceptances: [],
    });
    expect(out).toEqual([
      { kind: 'quote_sent', at: '2026-05-04T09:30:00Z', quote_id: 'q1' },
      { kind: 'quote_created', at: '2026-05-04T09:00:00Z', quote_id: 'q1', total_pence: 12000 },
    ]);
  });

  it('skips quote_sent when sent_at is null (still drafts)', () => {
    const out = mergeJobTimeline({
      stages: [],
      notes: [],
      calls: [],
      quotes: [
        {
          id: 'q2',
          created_at: '2026-05-04T09:00:00Z',
          sent_at: null,
          total_pence: 9000,
          status: 'draft',
        },
      ],
      acceptances: [],
    });
    expect(out.map((e) => e.kind)).toEqual(['quote_created']);
  });

  it('extracts the acceptor name from the consents JSON', () => {
    const out = mergeJobTimeline({
      stages: [],
      notes: [],
      calls: [],
      quotes: [],
      acceptances: [
        {
          quote_id: 'q1',
          accepted_at: '2026-05-04T12:00:00Z',
          consents: { accepted_full_name: 'Alice Brown' },
        },
      ],
    });
    expect(out).toEqual([
      {
        kind: 'quote_accepted',
        at: '2026-05-04T12:00:00Z',
        quote_id: 'q1',
        acceptor_name: 'Alice Brown',
      },
    ]);
  });

  it('breaks ties between same-timestamp events with a stable kind ranking', () => {
    const ts = '2026-05-04T12:00:00Z';
    const out = mergeJobTimeline({
      stages: [
        {
          changed_at: ts,
          from_stage: 'quoted',
          to_stage: 'accepted',
          reason: null,
          changed_by: null,
        },
      ],
      notes: [],
      calls: [],
      quotes: [],
      acceptances: [{ quote_id: 'q1', accepted_at: ts, consents: null }],
    });
    expect(out.map((e) => e.kind)).toEqual(['stage', 'quote_accepted']);
  });

  it('passes through actor names from the joined user rows', () => {
    const out = mergeJobTimeline({
      stages: [
        {
          changed_at: '2026-05-04T10:00:00Z',
          from_stage: null,
          to_stage: 'lead',
          reason: 'Created via webhook',
          changed_by: { full_name: 'System' },
        },
      ],
      notes: [
        {
          created_at: '2026-05-04T10:01:00Z',
          body: 'Note body',
          is_customer_visible: false,
          created_by: { full_name: 'Alice' },
        },
      ],
      calls: [],
      quotes: [],
      acceptances: [],
    });
    expect(out[0]).toMatchObject({ kind: 'note', actor: 'Alice' });
    expect(out[1]).toMatchObject({ kind: 'stage', actor: 'System', reason: 'Created via webhook' });
  });
});
