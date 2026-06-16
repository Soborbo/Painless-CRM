import {
  attachJobAddresses,
  createLeadJob,
  findOrCreateCustomer,
  type IntakeAddress,
} from '@/lib/jobs/intake';
import { type CmmResult } from './compare-my-move-schema';

// Normalises a validated CMM lead (residential / small-move / clearance) into
// the shared lead-intake primitives: a customer (deduped by email), a `lead`
// job tagged acquisition_source = compare_my_move, and from/to addresses. Every
// field without a dedicated jobs column is kept losslessly on intake_details.

export function mapCmmServiceType(
  leadType: string | null | undefined,
): 'removal' | 'waste_clearance' | undefined {
  if (leadType === 'clearance') return 'waste_clearance';
  // residential / small-move / international are all removals (international is
  // a cross-border move — still a removal; its exact field list is unconfirmed
  // so it degrades through the same current_*→new_* mapping as residential).
  if (leadType === 'residential' || leadType === 'small-move' || leadType === 'international') {
    return 'removal';
  }
  return undefined;
}

export function cmmFullName(r: CmmResult): string {
  const named = r.customer_name?.trim();
  if (named) return named.slice(0, 160);
  const composed = [r.first_name, r.surname].filter(Boolean).join(' ').trim();
  return (composed || r.email).slice(0, 160);
}

function yesNo(v: string | null | undefined): boolean | undefined {
  if (v === 'Yes') return true;
  if (v === 'No') return false;
  return undefined;
}

function toInt(v: number | string | null | undefined): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim()) {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function joinLines(...parts: (string | null | undefined)[]): string | null {
  const joined = parts
    .filter((p) => p && p.trim())
    .join(', ')
    .trim();
  return joined || null;
}

/** Map CMM addresses to from/to legs. Residential & small-move carry current →
 *  new; clearance carries a single property (the clearance site) as `from`. A
 *  leg is only built when it has a postcode (required on the addresses table). */
export function buildCmmAddresses(r: CmmResult): { from?: IntakeAddress; to?: IntakeAddress } {
  const out: { from?: IntakeAddress; to?: IntakeAddress } = {};
  if (r.lead_type === 'clearance') {
    if (r.postcode) {
      out.from = {
        line1: r.address_line_1 ?? r.town ?? r.postcode,
        line2: joinLines(r.address_line_2, r.address_line_3, r.address_line_4),
        city: r.town ?? '',
        postcode: r.postcode,
      };
    }
    return out;
  }
  if (r.current_postcode) {
    out.from = {
      line1: r.current_address_line_1 ?? r.current_town ?? r.current_postcode,
      line2: joinLines(r.current_address_line_2, r.current_address_line_3, r.current_address_line_4),
      city: r.current_town ?? '',
      postcode: r.current_postcode,
      floor: toInt(r.current_floor_level),
      has_lift: yesNo(r.current_lift),
      property_type: r.current_type ?? undefined,
    };
  }
  if (r.new_postcode) {
    out.to = {
      line1: r.new_address_line_1 ?? r.new_town ?? r.new_town_only ?? r.new_postcode,
      line2: joinLines(r.new_address_line_2, r.new_address_line_3, r.new_address_line_4),
      city: r.new_town ?? r.new_town_only ?? '',
      postcode: r.new_postcode,
    };
  }
  return out;
}

/** Human-readable lead notes (shown on the job). */
export function buildCmmNotes(r: CmmResult): string | null {
  const lines: string[] = [];
  if (r.cancelled === 'Yes') lines.push('⚠ CMM marked this lead CANCELLED — do not contact.');
  if (r.additional_information?.trim()) lines.push(r.additional_information.trim());
  if (r.van_type) lines.push(`Van requested: ${r.van_type}`);
  if (r.size) lines.push(`Clearance size: ${r.size}`);
  if (r.clearance_date) lines.push(`Clearance timescale: ${r.clearance_date}`);
  if (r.flexible_moving_date) lines.push(`Moving date flexible: ${r.flexible_moving_date}`);
  const packing = [
    r.packing_service_required === 'Yes' ? 'packing' : null,
    r.packing_materials_required === 'Yes' ? 'materials' : null,
    r.packing_dismantling_required === 'Yes' ? 'dismantling' : null,
  ].filter(Boolean);
  if (packing.length) lines.push(`Packing services: ${packing.join(', ')}`);
  return lines.length ? lines.join('\n') : null;
}

/** Lossless map of CMM fields without a dedicated jobs column. */
export function buildCmmIntakeDetails(r: CmmResult): Record<string, unknown> {
  const prune = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ''));
  const cmm = prune({
    quote_id: r.quote_id,
    lead_type: r.lead_type,
    cancelled: r.cancelled,
    created_at: r.created_at,
    current_bedrooms: toInt(r.current_bedrooms),
    new_bedrooms: toInt(r.new_bedrooms),
    current_storage_size: r.current_storage_size,
    current_county: r.current_county,
    current_udprn: r.current_udprn,
    new_county: r.new_county,
    new_udprn: r.new_udprn,
    van_type: r.van_type,
    size: r.size,
    clearance_date: r.clearance_date,
    flexible_moving_date: r.flexible_moving_date,
    packing_service_required: r.packing_service_required,
    packing_materials_required: r.packing_materials_required,
    packing_dismantling_required: r.packing_dismantling_required,
  });
  return { compare_my_move: cmm };
}

export interface IngestCmmResult {
  customer_id: string;
  job_id: string;
}

export async function ingestCompareMyMove(r: CmmResult, companyId: string): Promise<IngestCmmResult> {
  const source = 'compare_my_move';
  const postcode = r.current_postcode ?? r.postcode ?? undefined;
  const customerId = await findOrCreateCustomer({
    companyId,
    contact: {
      full_name: cmmFullName(r),
      email: r.email,
      phone: r.phone,
      postcode: postcode ? postcode.slice(0, 12) : undefined,
    },
    source,
  });

  const moveDate =
    r.moving_date && !Number.isNaN(Date.parse(r.moving_date))
      ? new Date(r.moving_date).toISOString()
      : null;

  const jobId = await createLeadJob({
    companyId,
    customerId,
    source,
    serviceType: mapCmmServiceType(r.lead_type) ?? null,
    moveDate,
    notes: buildCmmNotes(r),
    reason: `Webhook intake: Compare My Move (${r.lead_type ?? 'lead'})`,
    intakeDetails: buildCmmIntakeDetails(r),
  });

  const { from, to } = buildCmmAddresses(r);
  if (from || to) {
    await attachJobAddresses({ companyId, jobId, from, to });
  }

  return { customer_id: customerId, job_id: jobId };
}
