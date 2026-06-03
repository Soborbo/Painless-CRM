import {
  type MessageRow,
  groupThreads,
  sortThreadMessages,
  threadKey,
} from '@/lib/messages/thread';
import { describe, expect, it } from 'vitest';

function msg(over: Partial<MessageRow>): MessageRow {
  return {
    id: 'm',
    thread_id: null,
    customer_id: null,
    customer_name: null,
    job_id: null,
    channel: 'email',
    direction: 'outbound',
    subject: null,
    body: 'Hello',
    sent_at: '2026-06-10T09:00:00.000Z',
    from_address: null,
    to_address: null,
    ...over,
  };
}

describe('threadKey', () => {
  it('uses thread_id when present, else the message id', () => {
    expect(threadKey(msg({ id: 'a', thread_id: 't1' }))).toBe('t1');
    expect(threadKey(msg({ id: 'a', thread_id: null }))).toBe('a');
  });
});

describe('sortThreadMessages', () => {
  it('orders oldest first', () => {
    const out = sortThreadMessages([
      msg({ id: 'b', sent_at: '2026-06-10T10:00:00.000Z' }),
      msg({ id: 'a', sent_at: '2026-06-10T08:00:00.000Z' }),
    ]);
    expect(out.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('groupThreads', () => {
  it('groups by thread_id and counts, latest message drives the summary', () => {
    const threads = groupThreads([
      msg({ id: 'm1', thread_id: 't1', sent_at: '2026-06-10T08:00:00.000Z', subject: 'Quote' }),
      msg({
        id: 'm2',
        thread_id: 't1',
        sent_at: '2026-06-10T12:00:00.000Z',
        direction: 'inbound',
        body: 'Thanks, sounds good',
      }),
    ]);
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      key: 't1',
      routeId: 'm2',
      count: 2,
      subject: 'Quote',
      needsReply: true,
      lastDirection: 'inbound',
    });
  });

  it('treats unthreaded messages as singletons', () => {
    const threads = groupThreads([
      msg({ id: 'a', thread_id: null }),
      msg({ id: 'b', thread_id: null }),
    ]);
    expect(threads).toHaveLength(2);
    expect(threads.every((t) => t.count === 1)).toBe(true);
  });

  it('sorts threads by most recent activity first', () => {
    const threads = groupThreads([
      msg({ id: 'old', thread_id: 'old', sent_at: '2026-06-01T09:00:00.000Z' }),
      msg({ id: 'new', thread_id: 'new', sent_at: '2026-06-20T09:00:00.000Z' }),
    ]);
    expect(threads.map((t) => t.key)).toEqual(['new', 'old']);
  });

  it('flattens whitespace and truncates the preview', () => {
    const long = 'a'.repeat(200);
    const threads = groupThreads([msg({ id: 'p', body: `line1\n   line2  ${long}` })]);
    expect(threads[0]?.preview.endsWith('…')).toBe(true);
    expect(threads[0]?.preview).not.toContain('\n');
    expect((threads[0]?.preview.length ?? 0) <= 121).toBe(true);
  });

  it('outbound-last thread does not need a reply', () => {
    const threads = groupThreads([msg({ id: 'o', direction: 'outbound' })]);
    expect(threads[0]?.needsReply).toBe(false);
  });
});
