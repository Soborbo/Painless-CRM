// iMVE customer row → painless-crm customer insert shape. Pure transform; the loader
// (infra-gated, Phase 17 go-live) supplies company_id, id, version, addresses, etc.
// Mirrors MIGRATION_MAPPING.md §2 against the live schema (src/lib/schemas/customer.ts).

import {
  type CustomerType,
  classifyCustomerType,
  customerDedupKey,
  normalizeEmail,
  normalizePhone,
  normalizeText,
  splitName,
} from './normalize';

/** The columns we expect out of an iMVE customer CSV export. Free-text, untrusted. */
export type RawImveCustomer = {
  customerName?: string | null;
  email?: string | null;
  phone?: string | null;
  customerType?: string | null;
  companyName?: string | null;
  notes?: string | null;
  createdDate?: string | null;
};

/** The transform-owned subset of a painless-crm customers insert. */
export type CustomerTransformResult = {
  customer_type: CustomerType;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  notes: string | null;
  /** Original iMVE created date, preserved verbatim (ISO if parseable, else raw text). */
  created_at: string | null;
  /** Dedup key (email→phone); null when neither identifier is present. */
  dedup_key: string | null;
  /** True when no email AND no phone — the loader cannot auto-dedup; flag for review. */
  needs_manual_review: boolean;
};

export function transformCustomer(raw: RawImveCustomer): CustomerTransformResult {
  const customer_type = classifyCustomerType({
    explicitType: raw.customerType,
    customerName: raw.customerName,
    companyName: raw.companyName,
  });

  const { first_name, last_name } = splitName(raw.customerName);
  const company_name = normalizeText(raw.companyName);
  const primary_email = normalizeEmail(raw.email);
  const primary_phone = normalizePhone(raw.phone);
  const dedup_key = customerDedupKey({ email: raw.email, phone: raw.phone });

  return {
    customer_type,
    first_name,
    last_name,
    company_name: customer_type === 'business' ? company_name : null,
    primary_email,
    primary_phone,
    notes: normalizeText(raw.notes),
    created_at: normalizeText(raw.createdDate),
    dedup_key,
    needs_manual_review: dedup_key === null,
  };
}

/** Group transformed customers by dedup key so the loader inserts one row per real
 *  person. Rows with no dedup key (needs_manual_review) are returned individually under
 *  synthetic keys so none are silently merged. The first occurrence wins for scalar
 *  fields; callers may merge notes/addresses across the group as needed. */
export function groupByDedupKey(
  rows: readonly CustomerTransformResult[],
): Map<string, CustomerTransformResult[]> {
  const groups = new Map<string, CustomerTransformResult[]>();
  let orphan = 0;
  for (const row of rows) {
    const key = row.dedup_key ?? `__manual_${orphan++}`;
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}
