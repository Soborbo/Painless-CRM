import { mapCdrToPhoneCall } from '@/lib/integrations/tamar/cdr';
import { isOurNumber, parseTamarNumbers } from '@/lib/integrations/tamar/numbers';
import { describe, expect, it } from 'vitest';

const OURS = parseTamarNumbers('0117 974 0082, 01179740082');

describe('parseTamarNumbers', () => {
  it('normalises and de-duplicates to E.164', () => {
    expect(parseTamarNumbers('0117 974 0082')).toEqual(['+441179740082']);
    expect(parseTamarNumbers('0117 974 0082, 0117-974-0082')).toEqual(['+441179740082']);
    expect(parseTamarNumbers('+441179740082; 07700900123')).toEqual([
      '+441179740082',
      '+447700900123',
    ]);
  });

  it('drops blanks and returns [] for empty input', () => {
    expect(parseTamarNumbers('')).toEqual([]);
    expect(parseTamarNumbers(null)).toEqual([]);
    expect(parseTamarNumbers('  ,  ; ')).toEqual([]);
  });
});

describe('isOurNumber', () => {
  it('matches across formats', () => {
    expect(isOurNumber(OURS, '01179740082')).toBe(true);
    expect(isOurNumber(OURS, '+44 117 974 0082')).toBe(true);
    expect(isOurNumber(OURS, '07700900123')).toBe(false);
    expect(isOurNumber(OURS, null)).toBe(false);
  });
});

describe('mapCdrToPhoneCall (real Tamar /cdrs shape)', () => {
  it('maps a real not-answered inbound CDR as missed', () => {
    const res = mapCdrToPhoneCall(
      {
        uuid: 'aaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        start: '2023-01-09 10:04:48',
        ringing: '0.500',
        duration: '0.000',
        caller: '+447700900123',
        caller_UK: '07700900123',
        called: '+441179740082',
        called_UK: '01179740082',
        hangup_cause: 'NORMAL_CLEARING',
        call_result: 'Not answered',
      },
      OURS,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.call).toMatchObject({
      external_id: 'aaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      source: 'tamar_api',
      direction: 'inbound',
      caller_number: '+447700900123',
      called_number: '+441179740082',
      duration_seconds: 0,
      outcome: 'Not answered',
      missed: true,
    });
  });

  it('an answered inbound call is not missed; parses decimal duration', () => {
    const res = mapCdrToPhoneCall(
      {
        uuid: 'u2',
        start: '2023-01-09 11:00:00',
        duration: '125.000',
        caller: '+447700900123',
        called: '+441179740082',
        call_result: 'Answered',
      },
      OURS,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.call.duration_seconds).toBe(125);
    expect(res.call.missed).toBe(false);
  });

  it('classifies outbound when caller is our number', () => {
    const res = mapCdrToPhoneCall(
      { uuid: 'u3', caller: '+441179740082', called: '+447700900123', start: '2023-01-09 12:00:00' },
      OURS,
    );
    expect(res.ok && res.call.direction).toBe('outbound');
  });

  it('treats engaged as missed (caller did not get through)', () => {
    const res = mapCdrToPhoneCall(
      { uuid: 'u4', caller: '+447700900123', called: '+441179740082', start: '2023-01-09 13:00:00', duration: '0.000', call_result: 'Engaged' },
      OURS,
    );
    expect(res.ok && res.call.missed).toBe(true);
  });

  it('skips records with no id or no timestamp', () => {
    expect(mapCdrToPhoneCall({ caller: '07700900123' }, OURS)).toEqual({ ok: false, reason: 'no_id' });
    expect(mapCdrToPhoneCall({ uuid: 'a' }, OURS)).toEqual({ ok: false, reason: 'no_timestamp' });
  });
});
