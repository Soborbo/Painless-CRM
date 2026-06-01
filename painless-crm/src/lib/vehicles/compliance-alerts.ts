import { type ComplianceThreshold, reminderThresholdFor } from '@/lib/vehicles/compliance';

// Phase 08 §compliance auto-reminders — pure core. Given the fleet and the set
// of alerts already sent, decide which reminders fall due *today*. Kept free of
// I/O so the cron's logic is unit-tested without a DB or email provider.

export const COMPLIANCE_FIELDS = ['mot', 'tax', 'insurance', 'service'] as const;
export type ComplianceField = (typeof COMPLIANCE_FIELDS)[number];

// Maps each alertable field to its (date-typed) vehicle column.
type DateColumn = 'mot_due' | 'tax_due' | 'insurance_due' | 'next_service_due';
const FIELD_COLUMN: Record<ComplianceField, DateColumn> = {
  mot: 'mot_due',
  tax: 'tax_due',
  insurance: 'insurance_due',
  service: 'next_service_due',
};

export interface VehicleComplianceInput {
  id: string;
  company_id: string;
  registration: string;
  compliance_alerts_enabled: boolean;
  mot_due: string | null;
  tax_due: string | null;
  insurance_due: string | null;
  next_service_due: string | null;
}

export interface DueAlert {
  vehicle_id: string;
  company_id: string;
  registration: string;
  field: ComplianceField;
  due_date: string;
  threshold: ComplianceThreshold;
}

// Stable identity for the dedupe ledger / sent-set membership.
export function alertKey(a: {
  vehicle_id: string;
  field: ComplianceField;
  due_date: string;
  threshold: number;
}): string {
  return `${a.vehicle_id}:${a.field}:${a.due_date}:${a.threshold}`;
}

export function buildDueAlerts(
  vehicles: readonly VehicleComplianceInput[],
  alreadySent: ReadonlySet<string>,
  today: Date,
): DueAlert[] {
  const due: DueAlert[] = [];
  for (const v of vehicles) {
    if (!v.compliance_alerts_enabled) continue;
    for (const field of COMPLIANCE_FIELDS) {
      const dueDate = v[FIELD_COLUMN[field]];
      const threshold = reminderThresholdFor(dueDate, today);
      if (threshold === null || !dueDate) continue;
      const alert: DueAlert = {
        vehicle_id: v.id,
        company_id: v.company_id,
        registration: v.registration,
        field,
        due_date: dueDate,
        threshold,
      };
      if (alreadySent.has(alertKey(alert))) continue;
      due.push(alert);
    }
  }
  return due;
}

const FIELD_LABEL: Record<ComplianceField, string> = {
  mot: 'MOT',
  tax: 'Road tax',
  insurance: 'Insurance',
  service: 'Service',
};

export interface CompanyAlertDigest {
  company_id: string;
  recipients: string[];
  subject: string;
  text: string;
  alertCount: number;
}

// Groups the due alerts by company and renders one plain-text digest each.
// Companies with no recipients are dropped (nothing to send).
export function buildAlertDigests(
  alerts: readonly DueAlert[],
  recipientsByCompany: ReadonlyMap<string, string[]>,
): CompanyAlertDigest[] {
  const byCompany = new Map<string, DueAlert[]>();
  for (const a of alerts) {
    const list = byCompany.get(a.company_id) ?? [];
    list.push(a);
    byCompany.set(a.company_id, list);
  }

  const digests: CompanyAlertDigest[] = [];
  for (const [companyId, companyAlerts] of byCompany) {
    const recipients = recipientsByCompany.get(companyId) ?? [];
    if (recipients.length === 0) continue;

    const lines = companyAlerts
      .slice()
      .sort((a, b) => a.threshold - b.threshold || a.registration.localeCompare(b.registration))
      .map(
        (a) =>
          `• ${a.registration} — ${FIELD_LABEL[a.field]} due ${a.due_date} (in ${a.threshold} days)`,
      );

    const subject =
      companyAlerts.length === 1
        ? `Vehicle compliance reminder: ${companyAlerts[0]?.registration}`
        : `Vehicle compliance: ${companyAlerts.length} reminders`;

    digests.push({
      company_id: companyId,
      recipients,
      subject,
      text: `The following vehicle compliance dates are approaching:\n\n${lines.join('\n')}\n`,
      alertCount: companyAlerts.length,
    });
  }
  return digests;
}
