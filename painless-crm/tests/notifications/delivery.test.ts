import { describe, expect, it } from 'vitest';
import {
  planLondonFlush,
  planSweep,
  type PendingNotification,
  type RecipientDelivery,
} from '@/lib/notifications/delivery';

function notif(id: string, user: string, type: string): PendingNotification {
  return { id, recipient_user_id: user, type, title: `t-${id}`, link_url: null, created_at: '2026-06-15T08:00:00.000Z' };
}

function recipient(over: Partial<RecipientDelivery> = {}): RecipientDelivery {
  return { email: 'u@x.com', active: true, masterEnabled: true, prefs: {}, ...over };
}

describe('planSweep', () => {
  it('immediate bucket emails immediate-freq rows and janitors off / undeliverable rows', () => {
    const notifs = [
      notif('1', 'a', 'quote.accepted'), // default immediate → email
      notif('2', 'b', 'quote.sent'), // default off → janitor
      notif('3', 'c', 'quote.accepted'), // recipient inactive → janitor
      notif('4', 'd', 'lead.created'), // default daily → left for daily sweep
    ];
    const recipients = new Map<string, RecipientDelivery>([
      ['a', recipient({ email: 'a@x.com' })],
      ['b', recipient({ email: 'b@x.com' })],
      ['c', recipient({ active: false })],
      ['d', recipient({ email: 'd@x.com' })],
    ]);

    const plan = planSweep('immediate', notifs, recipients);
    expect(plan.emails).toHaveLength(1);
    expect(plan.emails[0]).toMatchObject({ to: 'a@x.com', ids: ['1'] });
    expect(plan.janitorIds.sort()).toEqual(['2', '3']);
  });

  it('master switch off janitors the user rows in the immediate sweep', () => {
    const notifs = [notif('1', 'a', 'quote.accepted'), notif('2', 'a', 'lead.created')];
    const recipients = new Map([['a', recipient({ masterEnabled: false })]]);
    const plan = planSweep('immediate', notifs, recipients);
    expect(plan.emails).toHaveLength(0);
    expect(plan.janitorIds.sort()).toEqual(['1', '2']);
  });

  it('daily bucket only emails daily-freq rows and never janitors', () => {
    const notifs = [
      notif('1', 'a', 'lead.created'), // daily → email
      notif('2', 'a', 'quote.accepted'), // immediate → left
      notif('3', 'b', 'quote.sent'), // off → left (janitor is immediate-only)
    ];
    const recipients = new Map([
      ['a', recipient({ email: 'a@x.com' })],
      ['b', recipient({ email: 'b@x.com' })],
    ]);
    const plan = planSweep('daily', notifs, recipients);
    expect(plan.janitorIds).toEqual([]);
    expect(plan.emails).toHaveLength(1);
    expect(plan.emails[0]).toMatchObject({ to: 'a@x.com', ids: ['1'] });
  });

  it('groups multiple rows for one recipient into a single email', () => {
    const notifs = [notif('1', 'a', 'lead.created'), notif('2', 'a', 'payment.recorded')];
    const recipients = new Map([['a', recipient({ email: 'a@x.com' })]]);
    const plan = planSweep('daily', notifs, recipients);
    expect(plan.emails).toHaveLength(1);
    const email = plan.emails[0]!;
    expect(email.ids.sort()).toEqual(['1', '2']);
    expect(email.subject).toContain('2 updates');
  });
});

describe('planLondonFlush', () => {
  it('fires at 09:00 London in summer (BST = 08:00 UTC)', () => {
    const f = planLondonFlush(new Date('2026-06-15T08:00:00Z')); // Monday
    expect(f.isDaily9am).toBe(true);
    expect(f.isWeeklyMon9am).toBe(true);
  });

  it('does not fire at 09:00 UTC in summer (that is 10:00 London)', () => {
    expect(planLondonFlush(new Date('2026-06-15T09:00:00Z')).isDaily9am).toBe(false);
  });

  it('fires at 09:00 London in winter (GMT = 09:00 UTC)', () => {
    expect(planLondonFlush(new Date('2026-01-19T09:00:00Z')).isDaily9am).toBe(true); // Monday
    expect(planLondonFlush(new Date('2026-01-19T08:00:00Z')).isDaily9am).toBe(false);
  });

  it('weekly flag is false on a non-Monday even at 09:00 London', () => {
    const f = planLondonFlush(new Date('2026-06-16T08:00:00Z')); // Tuesday BST
    expect(f.isDaily9am).toBe(true);
    expect(f.isWeeklyMon9am).toBe(false);
  });
});
