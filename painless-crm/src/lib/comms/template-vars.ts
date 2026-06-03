// Phase 13b (ADR-024) — builds the {{merge}} variable map for automation
// emails. Pure so the cron send step and its tests share one vocabulary. Every
// value is a string ('' when missing) — renderTemplate turns null/undefined
// into '' too, but resolving here keeps the contract explicit and testable.
//
// `company_name` is the SENDER (companies.name), not the customer's company —
// every iMVE template signs off with the agency name. See EMAIL_TEMPLATES.md §1.

import { customerDisplayName } from '@/lib/utils/format';

export interface AddressParts {
  line1: string | null;
  line2: string | null;
  city: string | null;
  postcode: string | null;
}

export interface TemplateVarSource {
  jobNumber: string | null;
  /** timestamptz — move day */
  moveDate: string | null;
  /** free-text crew arrival slot, e.g. "8:00–9:00" (ADR-026) */
  arrivalWindow: string | null;
  /** timestamptz — survey/home-visit booking */
  surveyAt: string | null;
  fromStage?: string | null;
  toStage?: string | null;
  customer: {
    customer_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    primary_email: string | null;
  } | null;
  /** companies.name — the sender */
  senderCompanyName: string | null;
  /** the job's "from" address */
  currentAddress: AddressParts | null;
  /** the job's "to" address */
  newAddress: AddressParts | null;
}

const DATE = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' });
const TIME = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' });

function dateOnly(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : DATE.format(d);
}

function timeOnly(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : TIME.format(d);
}

/** One-line postal address for email bodies; '' when no address. */
export function formatAddressLine(addr: AddressParts | null): string {
  if (!addr) return '';
  return [addr.line1, addr.line2, addr.city, addr.postcode]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');
}

export function buildTemplateVars(source: TemplateVarSource): Record<string, string> {
  const c = source.customer;
  return {
    first_name: c?.first_name ?? '',
    last_name: c?.last_name ?? '',
    customer_name: c ? customerDisplayName(c) : '',
    company_name: source.senderCompanyName ?? '',
    job_number: source.jobNumber ?? '',
    move_date: dateOnly(source.moveDate),
    move_time: source.arrivalWindow ?? '',
    booked_date: dateOnly(source.surveyAt),
    booked_time: timeOnly(source.surveyAt),
    current_address: formatAddressLine(source.currentAddress),
    new_address: formatAddressLine(source.newAddress),
    from_stage: source.fromStage ?? '',
    to_stage: source.toStage ?? '',
  };
}
