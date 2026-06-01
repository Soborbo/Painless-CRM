import {
  type VehicleComplianceInput,
  alertKey,
  buildAlertDigests,
  buildDueAlerts,
} from '@/lib/vehicles/compliance-alerts';
import { describe, expect, it } from 'vitest';

const TODAY = new Date('2026-06-01T06:00:00.000Z');

function vehicle(overrides: Partial<VehicleComplianceInput>): VehicleComplianceInput {
  return {
    id: 'v1',
    company_id: 'c1',
    registration: 'AB12 CDE',
    compliance_alerts_enabled: true,
    mot_due: null,
    tax_due: null,
    insurance_due: null,
    next_service_due: null,
    ...overrides,
  };
}

describe('buildDueAlerts', () => {
  it('fires only on the exact 30/14/7-day marks', () => {
    const v = vehicle({ mot_due: '2026-07-01' }); // 30 days out
    const alerts = buildDueAlerts([v], new Set(), TODAY);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ field: 'mot', threshold: 30, due_date: '2026-07-01' });
  });

  it('does not fire between marks', () => {
    const v = vehicle({ mot_due: '2026-06-20' }); // 19 days out
    expect(buildDueAlerts([v], new Set(), TODAY)).toHaveLength(0);
  });

  it('skips vehicles with alerts disabled', () => {
    const v = vehicle({ mot_due: '2026-07-01', compliance_alerts_enabled: false });
    expect(buildDueAlerts([v], new Set(), TODAY)).toHaveLength(0);
  });

  it('suppresses alerts already in the sent set', () => {
    const v = vehicle({ tax_due: '2026-06-15' }); // 14 days out
    const sent = new Set([
      alertKey({ vehicle_id: 'v1', field: 'tax', due_date: '2026-06-15', threshold: 14 }),
    ]);
    expect(buildDueAlerts([v], sent, TODAY)).toHaveLength(0);
  });

  it('emits one alert per due field crossing today', () => {
    const v = vehicle({ mot_due: '2026-07-01', insurance_due: '2026-06-08' }); // 30 + 7
    const alerts = buildDueAlerts([v], new Set(), TODAY);
    expect(alerts.map((a) => a.field).sort()).toEqual(['insurance', 'mot']);
  });
});

describe('buildAlertDigests', () => {
  it('groups by company and drops companies with no recipients', () => {
    const alerts = buildDueAlerts(
      [
        vehicle({ id: 'v1', company_id: 'c1', registration: 'AAA', mot_due: '2026-07-01' }),
        vehicle({ id: 'v2', company_id: 'c2', registration: 'BBB', tax_due: '2026-06-08' }),
      ],
      new Set(),
      TODAY,
    );
    const recipients = new Map([['c1', ['a@x.com']]]); // c2 has none
    const digests = buildAlertDigests(alerts, recipients);
    expect(digests).toHaveLength(1);
    expect(digests[0]?.company_id).toBe('c1');
    expect(digests[0]?.recipients).toEqual(['a@x.com']);
    expect(digests[0]?.text).toContain('AAA');
  });

  it('summarises a multi-alert digest in the subject', () => {
    const alerts = buildDueAlerts(
      [vehicle({ mot_due: '2026-07-01', insurance_due: '2026-06-08' })],
      new Set(),
      TODAY,
    );
    const digests = buildAlertDigests(alerts, new Map([['c1', ['a@x.com']]]));
    expect(digests[0]?.alertCount).toBe(2);
    expect(digests[0]?.subject).toContain('2 reminders');
  });
});
