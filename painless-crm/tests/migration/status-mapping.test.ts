import { describe, expect, it } from 'vitest';
import {
  UnmappedStatusError,
  isMappableStatus,
  knownStatusKeys,
  mapStatus,
  normalizeKey,
} from '@/lib/migration/status-mapping';
import { JOB_STAGES } from '@/lib/jobs/state-machine';

describe('mapStatus', () => {
  it('maps a simple status to a stage', () => {
    expect(mapStatus('New Enquiry')).toEqual({
      stage: 'lead',
      sub_status: null,
      decline_reason: null,
      storage_status: null,
    });
  });

  it('maps a status with a sub_status', () => {
    expect(mapStatus('Awaiting Callback')).toMatchObject({
      stage: 'contacted',
      sub_status: 'awaiting_callback',
    });
  });

  it('maps a lost status to a decline_reason', () => {
    expect(mapStatus('Lost — Too Expensive')).toMatchObject({
      stage: 'declined',
      decline_reason: 'too_expensive',
    });
  });

  it('maps "Lost — No Response" to dead, not declined', () => {
    expect(mapStatus('Lost — No Response').stage).toBe('dead');
  });

  it('maps storage statuses to paid + a storage_status', () => {
    expect(mapStatus('Storage Active')).toMatchObject({ stage: 'paid', storage_status: 'active' });
    expect(mapStatus('Storage Terminated')).toMatchObject({
      stage: 'paid',
      storage_status: 'terminated',
    });
  });

  it('maps "Job Done — Awaiting Payment" to invoiced', () => {
    expect(mapStatus('Job Done — Awaiting Payment').stage).toBe('invoiced');
  });

  it('is tolerant of dash style, casing, and extra whitespace', () => {
    const a = mapStatus('Quote Sent - Followup 1');
    const b = mapStatus('quote sent — followup 1');
    const c = mapStatus('  Quote   Sent  –  Followup 1 ');
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(a.sub_status).toBe('followup_sent_1');
  });

  it('throws UnmappedStatusError on an unknown status — never silently defaults', () => {
    expect(() => mapStatus('Totally Made Up Status')).toThrow(UnmappedStatusError);
    try {
      mapStatus('Totally Made Up Status');
    } catch (e) {
      expect((e as UnmappedStatusError).rawStatus).toBe('Totally Made Up Status');
    }
  });

  it('only ever maps to canonical job stages', () => {
    const stages = new Set<string>(JOB_STAGES);
    for (const key of knownStatusKeys()) {
      expect(stages.has(mapStatus(key).stage)).toBe(true);
    }
  });
});

describe('isMappableStatus', () => {
  it('is true for known statuses and false for unknown ones', () => {
    expect(isMappableStatus('Paid')).toBe(true);
    expect(isMappableStatus('paid')).toBe(true);
    expect(isMappableStatus('Nope')).toBe(false);
  });
});

describe('normalizeKey', () => {
  it('lowercases, collapses whitespace, and unifies dashes', () => {
    expect(normalizeKey('  Lost —  Chose   Competitor ')).toBe('lost - chose competitor');
  });
});
