import type { AcquisitionSource } from '@/lib/schemas/job';

// SLA deadline calculator for new leads.
//
// Phase 06b §1 / ADR-016: every lead gets a `first_response_due_at`
// computed at create time as `enquiry_at + sla_minutes`. The minutes are
// configurable per `acquisition_source` (faster SLA for paid sources where
// conversion correlates strongly with response speed). v0.1 ships fixed
// defaults; per-tenant overrides land when the settings UI does.

export const DEFAULT_SLA_MINUTES = 15;

export const SLA_MINUTES_BY_SOURCE: Partial<Record<AcquisitionSource, number>> = {
  google_ads: 10,
  meta_ads: 10,
  website: 15,
  phone: 5,
  referral: 30,
  affiliate: 30,
  walk_in: 60,
  b2b_outreach: 60,
  other: 30,
};

export function slaMinutesForSource(source: string | null | undefined): number {
  if (!source) return DEFAULT_SLA_MINUTES;
  const lookup = SLA_MINUTES_BY_SOURCE[source as AcquisitionSource];
  return typeof lookup === 'number' ? lookup : DEFAULT_SLA_MINUTES;
}

export function computeFirstResponseDueAt(
  enquiryAt: Date | string,
  source: string | null | undefined,
): string {
  const enquiry = typeof enquiryAt === 'string' ? new Date(enquiryAt) : enquiryAt;
  if (Number.isNaN(enquiry.getTime())) {
    throw new Error('computeFirstResponseDueAt: invalid enquiry timestamp');
  }
  const minutes = slaMinutesForSource(source);
  return new Date(enquiry.getTime() + minutes * 60_000).toISOString();
}
