import { describe, expect, it } from 'vitest';
import {
  defaultFreqFor,
  EVENT_CATALOG,
  eventKeys,
  getEvent,
  normaliseEventKey,
} from '@/lib/notifications/events';

describe('notification event catalog', () => {
  it('has unique keys', () => {
    const keys = eventKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('exposes the leads the original request needs', () => {
    for (const key of ['lead.created', 'lead.high_value_uncontacted', 'quote.accepted', 'quote.created']) {
      expect(getEvent(key)).toBeDefined();
    }
  });

  it('exposes the missed inbound call event (ADR-041) as a broadcast', () => {
    const e = getEvent('call.missed');
    expect(e).toBeDefined();
    expect(e?.scope).toBe('broadcast');
    expect(e?.defaultFreq).toBe('immediate');
  });

  it('exposes the inbound email event (ADR-044) as an immediate broadcast', () => {
    const e = getEvent('email.received');
    expect(e).toBeDefined();
    expect(e?.scope).toBe('broadcast');
    expect(e?.defaultFreq).toBe('immediate');
    expect(e?.group).toBe('sales');
  });

  it('targeted events carry an intrinsic recipient (mention, job.assigned)', () => {
    expect(getEvent('mention')?.scope).toBe('targeted');
    expect(getEvent('job.assigned')?.scope).toBe('targeted');
  });

  it('every catalog event has both labels and a valid default frequency', () => {
    for (const e of EVENT_CATALOG) {
      expect(e.labelEn.length).toBeGreaterThan(0);
      expect(e.labelHu.length).toBeGreaterThan(0);
      expect(['off', 'immediate', 'hourly', 'daily', 'weekly']).toContain(e.defaultFreq);
    }
  });

  it('maps legacy type strings to catalog keys', () => {
    expect(normaliseEventKey('assignment')).toBe('job.assigned');
    expect(normaliseEventKey('sla_breach')).toBe('lead.sla_breach');
    expect(normaliseEventKey('review_arrived')).toBe('review.received');
    expect(normaliseEventKey('lead.created')).toBe('lead.created');
    expect(normaliseEventKey('totally.unknown')).toBe('totally.unknown');
  });

  it('defaultFreqFor falls back to off for unknown keys', () => {
    expect(defaultFreqFor('nope')).toBe('off');
    expect(defaultFreqFor('lead.created')).toBe('daily');
  });
});
