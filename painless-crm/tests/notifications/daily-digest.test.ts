import {
  type DigestNotification,
  type DigestRecipient,
  buildDailyDigests,
} from '@/lib/notifications/daily-digest';
import { describe, expect, it } from 'vitest';

function notif(o: Partial<DigestNotification>): DigestNotification {
  return {
    recipient_user_id: 'u1',
    type: 'mention',
    title: 'You were mentioned',
    link_url: null,
    created_at: '2026-06-02T08:00:00Z',
    ...o,
  };
}

const RECIPIENTS: DigestRecipient[] = [
  { user_id: 'u1', email: 'u1@test', digest_enabled: true },
  { user_id: 'u2', email: 'u2@test', digest_enabled: true },
];

describe('buildDailyDigests', () => {
  it('builds one digest per recipient with their own notifications', () => {
    const digests = buildDailyDigests(
      [
        notif({ recipient_user_id: 'u1', title: 'Assigned job J-1' }),
        notif({ recipient_user_id: 'u1', title: 'Mentioned on J-2' }),
        notif({ recipient_user_id: 'u2', title: 'Assigned job J-3' }),
      ],
      RECIPIENTS,
    );
    expect(digests).toHaveLength(2);
    const u1 = digests.find((d) => d.userId === 'u1');
    expect(u1?.recipients).toEqual(['u1@test']);
    expect(u1?.subject).toBe('2 new notifications');
    expect(u1?.text).toContain('Assigned job J-1');
    expect(u1?.text).toContain('Mentioned on J-2');
  });

  it('uses the singular subject for one notification', () => {
    const digests = buildDailyDigests([notif({ recipient_user_id: 'u1' })], RECIPIENTS);
    expect(digests[0]?.subject).toBe('1 new notification');
  });

  it('orders notification lines newest first', () => {
    const digests = buildDailyDigests(
      [
        notif({ recipient_user_id: 'u1', title: 'older', created_at: '2026-06-02T06:00:00Z' }),
        notif({ recipient_user_id: 'u1', title: 'newer', created_at: '2026-06-02T09:00:00Z' }),
      ],
      RECIPIENTS,
    );
    const text = digests[0]?.text ?? '';
    expect(text.indexOf('newer')).toBeLessThan(text.indexOf('older'));
  });

  it('skips recipients with the digest disabled', () => {
    const digests = buildDailyDigests(
      [notif({ recipient_user_id: 'u1' })],
      [{ user_id: 'u1', email: 'u1@test', digest_enabled: false }],
    );
    expect(digests).toHaveLength(0);
  });

  it('skips recipients with no email', () => {
    const digests = buildDailyDigests(
      [notif({ recipient_user_id: 'u1' })],
      [{ user_id: 'u1', email: '', digest_enabled: true }],
    );
    expect(digests).toHaveLength(0);
  });

  it('skips recipients with no notifications in the window', () => {
    const digests = buildDailyDigests([notif({ recipient_user_id: 'u2' })], RECIPIENTS);
    expect(digests.map((d) => d.userId)).toEqual(['u2']);
  });
});
