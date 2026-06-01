import { SLA_RESPONSIVE_STAGES, shouldRecordFirstResponse } from '@/lib/jobs/sla-touch';
import type { JobStage } from '@/lib/jobs/state-machine';
import { describe, expect, it } from 'vitest';

const OCCURRED = '2026-05-31T09:00:00.000Z';

describe('shouldRecordFirstResponse', () => {
  it('records the first response on a fresh lead/contacted job', () => {
    for (const stage of SLA_RESPONSIVE_STAGES) {
      expect(
        shouldRecordFirstResponse({ stage, firstResponseAt: null, occurredAt: OCCURRED }),
      ).toBe(true);
    }
  });

  it('does not re-record once first_response_at is already set', () => {
    expect(
      shouldRecordFirstResponse({
        stage: 'lead',
        firstResponseAt: '2026-05-30T08:00:00.000Z',
        occurredAt: OCCURRED,
      }),
    ).toBe(false);
  });

  it('does not record for a stage past the responsive window', () => {
    const laterStages: JobStage[] = ['quoted', 'accepted', 'completed'];
    for (const stage of laterStages) {
      expect(
        shouldRecordFirstResponse({ stage, firstResponseAt: null, occurredAt: OCCURRED }),
      ).toBe(false);
    }
  });

  it('rejects an unparseable occurredAt', () => {
    expect(
      shouldRecordFirstResponse({ stage: 'lead', firstResponseAt: null, occurredAt: 'not-a-date' }),
    ).toBe(false);
  });

  it('exposes lead and contacted as the responsive stages', () => {
    expect(SLA_RESPONSIVE_STAGES).toEqual(['lead', 'contacted']);
  });
});
