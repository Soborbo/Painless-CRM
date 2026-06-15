import { describe, expect, it } from 'vitest';
import {
  effectiveFreq,
  parseEventPrefs,
  resolveSubscribers,
  sanitiseEventPrefs,
  type SubscriberPref,
} from '@/lib/notifications/prefs';

describe('parseEventPrefs', () => {
  it('keeps valid (catalog key, frequency) pairs and drops the rest', () => {
    const out = parseEventPrefs({
      'lead.created': 'daily',
      'quote.accepted': 'immediate',
      'not.a.real.event': 'daily', // unknown key dropped
      'lead.sla_breach': 'sometimes', // invalid freq dropped
    });
    expect(out).toEqual({ 'lead.created': 'daily', 'quote.accepted': 'immediate' });
  });

  it('normalises legacy keys', () => {
    expect(parseEventPrefs({ assignment: 'hourly' })).toEqual({ 'job.assigned': 'hourly' });
  });

  it('never throws on garbage', () => {
    expect(parseEventPrefs(null)).toEqual({});
    expect(parseEventPrefs('x')).toEqual({});
    expect(parseEventPrefs([1, 2])).toEqual({});
  });
});

describe('sanitiseEventPrefs', () => {
  it('keeps only catalog keys with valid frequencies', () => {
    const out = sanitiseEventPrefs({
      'lead.created': 'weekly',
      'payment.recorded': 'off',
      bogus: 'daily',
      'quote.sent': 'nope',
    });
    expect(out).toEqual({ 'lead.created': 'weekly', 'payment.recorded': 'off' });
  });
});

describe('effectiveFreq', () => {
  it('uses the explicit pref when set', () => {
    expect(effectiveFreq({ 'lead.created': 'weekly' }, 'lead.created')).toBe('weekly');
  });
  it('falls back to the catalog default when unset', () => {
    expect(effectiveFreq({}, 'quote.accepted')).toBe('immediate');
    expect(effectiveFreq({}, 'quote.sent')).toBe('off');
  });
});

describe('resolveSubscribers', () => {
  const candidates: SubscriberPref[] = [
    { user_id: 'a', prefs: { 'lead.created': 'daily' } },
    { user_id: 'b', prefs: { 'lead.created': 'off' } },
    { user_id: 'c', prefs: {} }, // inherits default (daily → subscribed)
  ];

  it('includes users whose effective freq is not off', () => {
    expect(resolveSubscribers(candidates, 'lead.created').sort()).toEqual(['a', 'c']);
  });

  it('excludes everyone for a default-off event unless they opt in', () => {
    // quote.sent default is off; only an explicit non-off opts in.
    const list = resolveSubscribers(
      [
        { user_id: 'a', prefs: {} },
        { user_id: 'b', prefs: { 'quote.sent': 'daily' } },
      ],
      'quote.sent',
    );
    expect(list).toEqual(['b']);
  });
});
