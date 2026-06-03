// Field normalizers for the iMVE import. Pure functions — no I/O.
// Mirrors MIGRATION_MAPPING.md §2 (email lowercase/trim, phone → E.164, B2C/B2B detect).

// painless-crm's customer_type values (src/lib/schemas/customer.ts), NOT iMVE's B2C/B2B.
export type CustomerType = 'individual' | 'business';

/** Lowercase + trim. Returns null for blank/whitespace-only input. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  return cleaned === '' ? null : cleaned;
}

/** Normalize a UK phone number to E.164 (+44…). Best-effort: strips spaces, dashes,
 *  parens, and a leading "(0)". Handles "0…", "44…", "+44…", and "0044…" forms.
 *  Returns null when no plausible digits remain. Non-UK / unrecognized numbers are
 *  returned digit-cleaned with a leading "+" only if they already carried one. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const hadPlus = raw.trim().startsWith('+');
  const digits = raw.replace(/[^\d]/g, '');
  if (digits === '') return null;

  if (digits.startsWith('0044')) return `+44${stripLeadingZero(digits.slice(4))}`;
  if (digits.startsWith('44')) return `+44${stripLeadingZero(digits.slice(2))}`;
  if (digits.startsWith('0')) return `+44${digits.slice(1)}`;
  // Already-international or unknown: preserve a "+" only if the source had one.
  return hadPlus ? `+${digits}` : `+44${digits}`;
}

function stripLeadingZero(d: string): string {
  return d.startsWith('0') ? d.slice(1) : d;
}

const COMPANY_INDICATORS = [
  'ltd',
  'limited',
  'llp',
  'plc',
  'gmbh',
  'inc',
  'co.',
  ' co ',
  'group',
  'holdings',
  'services',
  'properties',
  'lettings',
  'estates',
  'estate agent',
  'solicitors',
  'removals',
  'company',
];

/** Classify a customer as 'business' or 'individual' (painless-crm customer_type values).
 *  An explicit iMVE "Customer Type" wins (its B2B→business, B2C→individual); otherwise
 *  infer from a company name being present, or company indicators in the name string.
 *  MIGRATION_MAPPING.md §2: "Detect by presence of company indicator". */
export function classifyCustomerType(input: {
  explicitType?: string | null;
  customerName?: string | null;
  companyName?: string | null;
}): CustomerType {
  const explicit = input.explicitType?.trim().toLowerCase();
  if (explicit === 'b2b' || explicit === 'business') return 'business';
  if (explicit === 'b2c' || explicit === 'individual') return 'individual';

  if (input.companyName && input.companyName.trim() !== '') return 'business';

  const name = (input.customerName ?? '').toLowerCase();
  if (COMPANY_INDICATORS.some((ind) => name.includes(ind))) return 'business';

  return 'individual';
}

/** Split a free-text customer name into (first_name, last_name). The last whitespace
 *  token is the surname; everything before it is the forename(s). Single-token names
 *  go entirely into first_name with a null last_name. Blank input → both null. */
export function splitName(raw: string | null | undefined): {
  first_name: string | null;
  last_name: string | null;
} {
  const cleaned = normalizeText(raw);
  if (!cleaned) return { first_name: null, last_name: null };
  const parts = cleaned.split(' ');
  if (parts.length === 1) return { first_name: parts[0] ?? null, last_name: null };
  const last_name = parts[parts.length - 1] ?? null;
  const first_name = parts.slice(0, -1).join(' ') || null;
  return { first_name, last_name };
}

/** Collapse internal whitespace and trim; returns null for blank input. Used for names
 *  and free-text where empty should become null rather than "". */
export function normalizeText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  return cleaned === '' ? null : cleaned;
}

/** Deterministic dedup key for matching customers across multiple iMVE rows.
 *  Preference order per MIGRATION_MAPPING.md §2: email, then phone. Returns null when
 *  neither is present (such rows can't be auto-deduped — flagged for manual review). */
export function customerDedupKey(input: {
  email?: string | null;
  phone?: string | null;
}): string | null {
  const email = normalizeEmail(input.email);
  if (email) return `email:${email}`;
  const phone = normalizePhone(input.phone);
  if (phone) return `phone:${phone}`;
  return null;
}
