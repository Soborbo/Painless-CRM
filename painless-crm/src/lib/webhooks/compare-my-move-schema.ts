import { z } from 'zod';
import type { BodySignedEnvelope } from './handler-v3';

// Compare My Move residential / small-move / clearance lead payload (ADR-042).
// CMM warns payloads vary by split-test, so the schema is deliberately lenient:
// only the fields we genuinely need (quote_id for dedup, email/phone/name for
// the customer) are required; everything else is nullish and preserved via the
// curated intake_details map. `.passthrough()` keeps any unforeseen field on
// the stored webhook_events.payload too, so nothing is ever silently dropped.

const nstr = z.string().max(400).nullish();
const num = z.union([z.number(), z.string()]).nullish();
const pc = z.string().max(12).nullish();

export const CmmResultSchema = z
  .object({
    lead_type: z.string().max(40).nullish(),
    quote_id: z.string().min(1).max(120),
    first_name: z.string().max(120).nullish(),
    surname: z.string().max(120).nullish(),
    customer_name: z.string().max(200).nullish(),
    email: z.string().email().max(160),
    phone: z.string().min(5).max(40),
    cancelled: z.string().max(8).nullish(),
    created_at: nstr,
    // current property (residential / small-move)
    current_address_line_1: nstr,
    current_address_line_2: nstr,
    current_address_line_3: nstr,
    current_address_line_4: nstr,
    current_town: nstr,
    current_county: nstr,
    current_postcode: pc,
    current_udprn: nstr,
    current_bedrooms: num,
    current_storage_size: nstr,
    current_lift: nstr,
    current_floor_level: num,
    current_type: nstr,
    van_type: nstr,
    // new property (residential / small-move)
    new_address_line_1: nstr,
    new_address_line_2: nstr,
    new_address_line_3: nstr,
    new_address_line_4: nstr,
    new_town: nstr,
    new_town_only: nstr,
    new_county: nstr,
    new_postcode: pc,
    new_udprn: nstr,
    new_bedrooms: num,
    moving_date: nstr,
    flexible_moving_date: nstr,
    additional_information: z.string().max(4000).nullish(),
    packing_service_required: nstr,
    packing_materials_required: nstr,
    packing_dismantling_required: nstr,
    // clearance (single address)
    address_line_1: nstr,
    address_line_2: nstr,
    address_line_3: nstr,
    address_line_4: nstr,
    town: nstr,
    county: nstr,
    postcode: pc,
    udprn: nstr,
    size: nstr,
    clearance_date: nstr,
  })
  .passthrough();

export type CmmResult = z.infer<typeof CmmResultSchema>;

/** The exact string CMM HMAC-signs: the timestamp and token concatenated. */
export function cmmSignedString(timestamp: unknown, token: unknown): string {
  return `${timestamp ?? ''}${token ?? ''}`;
}

/** Build the v3 auth/dedup envelope from CMM's top-level JSON body. */
export function cmmEnvelope(json: Record<string, unknown>): BodySignedEnvelope<unknown> | null {
  const result = json.result;
  if (typeof result !== 'object' || result === null) return null;
  const quoteId = (result as Record<string, unknown>).quote_id;
  if (typeof quoteId !== 'string' || quoteId.length === 0) return null;
  const signature = typeof json.signature === 'string' ? json.signature : null;
  return {
    signedString: cmmSignedString(json.timestamp, json.token),
    signature,
    payload: result,
    eventId: quoteId,
  };
}
