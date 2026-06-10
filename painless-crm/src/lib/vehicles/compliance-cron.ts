import { sendVehicleComplianceEmail } from '@/lib/integrations/resend/vehicle-compliance';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  type DueAlert,
  type VehicleComplianceInput,
  alertKey,
  buildAlertDigests,
  buildDueAlerts,
} from '@/lib/vehicles/compliance-alerts';

// Daily 06:00 compliance-reminder sweep (Phase 08). Runs without a user, so it
// reads/writes with the service-role client and scopes nothing by RLS. The pure
// builder decides which reminders fall due today; this layer fetches the fleet,
// the recipients, and the already-sent ledger, then records + emails the rest.

const RECIPIENT_ROLES = ['manager', 'admin'] as const;
const MAX_VEHICLES = 5000;

const VEHICLE_COLUMNS =
  'id, company_id, registration, compliance_alerts_enabled, mot_due, tax_due, insurance_due, next_service_due';

export interface ComplianceCronResult {
  vehiclesScanned: number;
  alertsDue: number;
  emailsSent: number;
}

export async function runVehicleComplianceSweep(
  now: Date = new Date(),
): Promise<ComplianceCronResult> {
  const supabase = createAdminClient();

  const { data: vehicleRows } = await supabase
    .from('vehicles')
    .select(VEHICLE_COLUMNS)
    .is('deleted_at', null)
    .eq('active', true)
    .eq('compliance_alerts_enabled', true)
    .limit(MAX_VEHICLES);
  const vehicles = (vehicleRows ?? []) as VehicleComplianceInput[];

  if (vehicles.length === 0) {
    return { vehiclesScanned: 0, alertsDue: 0, emailsSent: 0 };
  }

  // Pull the ledger only for the vehicles in scope, then let the pure builder
  // filter out anything already sent. The unique constraint is the backstop.
  const { data: sentRows } = await supabase
    .from('vehicle_compliance_alerts')
    .select('vehicle_id, field, due_date, threshold')
    .in(
      'vehicle_id',
      vehicles.map((v) => v.id),
    );
  const sent = new Set(
    (
      (sentRows ?? []) as Array<{
        vehicle_id: string;
        field: string;
        due_date: string;
        threshold: number;
      }>
    ).map((r) =>
      alertKey({
        vehicle_id: r.vehicle_id,
        field: r.field as DueAlert['field'],
        due_date: r.due_date,
        threshold: r.threshold,
      }),
    ),
  );

  const alerts = buildDueAlerts(vehicles, sent, now);
  if (alerts.length === 0) {
    return { vehiclesScanned: vehicles.length, alertsDue: 0, emailsSent: 0 };
  }

  // Record before emailing: a failed email is better than a duplicate one, and
  // the unique constraint makes the insert idempotent across retries.
  await supabase.from('vehicle_compliance_alerts').upsert(
    alerts.map((a) => ({
      company_id: a.company_id,
      vehicle_id: a.vehicle_id,
      field: a.field,
      due_date: a.due_date,
      threshold: a.threshold,
      sent_at: now.toISOString(),
    })),
    { onConflict: 'vehicle_id,field,due_date,threshold', ignoreDuplicates: true },
  );

  const companyIds = [...new Set(alerts.map((a) => a.company_id))];
  const { data: recipientRows } = await supabase
    .from('users')
    .select('company_id, email')
    .eq('active', true)
    .in('role', RECIPIENT_ROLES)
    .in('company_id', companyIds);

  const recipientsByCompany = new Map<string, string[]>();
  for (const row of (recipientRows ?? []) as Array<{ company_id: string; email: string | null }>) {
    if (!row.email) continue;
    const list = recipientsByCompany.get(row.company_id) ?? [];
    list.push(row.email);
    recipientsByCompany.set(row.company_id, list);
  }

  const digests = buildAlertDigests(alerts, recipientsByCompany);
  let emailsSent = 0;
  for (const digest of digests) {
    const sent = await sendVehicleComplianceEmail({
      to: digest.recipients,
      subject: digest.subject,
      text: digest.text,
    });
    if (sent) emailsSent += 1;
  }

  return { vehiclesScanned: vehicles.length, alertsDue: alerts.length, emailsSent };
}
