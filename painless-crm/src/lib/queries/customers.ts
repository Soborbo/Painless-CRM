import {
  CUSTOMER_PAGE_SIZE,
  type CustomerListFilters,
  type CustomerType,
} from '@/lib/schemas/customer';
import { createClient } from '@/lib/supabase/server';
import { customerDisplayName } from '@/lib/utils/format';

export type CustomerRow = {
  id: string;
  customer_type: CustomerType;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  acquisition_source: string | null;
  marketing_consent: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  vat_number?: string | null;
  payment_terms_days?: number | null;
};

export type CustomerListResult = {
  rows: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
};

const LIST_COLUMNS =
  'id, customer_type, first_name, last_name, company_name, primary_email, primary_phone, acquisition_source, created_at, version';

const DETAIL_COLUMNS =
  'id, customer_type, first_name, last_name, company_name, vat_number, payment_terms_days, primary_email, primary_phone, acquisition_source, acquisition_campaign, marketing_consent, marketing_consent_at, notes, created_at, updated_at, version';

export async function listCustomers(filters: CustomerListFilters): Promise<CustomerListResult> {
  const supabase = await createClient();
  const page = filters.page;
  const from = (page - 1) * CUSTOMER_PAGE_SIZE;
  const to = from + CUSTOMER_PAGE_SIZE - 1;

  let query = supabase
    .from('customers')
    .select(LIST_COLUMNS, { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.type) query = query.eq('customer_type', filters.type);
  if (filters.created_from)
    query = query.gte('created_at', `${filters.created_from}T00:00:00.000Z`);
  if (filters.created_to) query = query.lte('created_at', `${filters.created_to}T23:59:59.999Z`);
  if (filters.q) {
    const safe = filters.q.replace(/[%_,]/g, ' ');
    const pattern = `%${safe}%`;
    query = query.or(
      [
        `first_name.ilike.${pattern}`,
        `last_name.ilike.${pattern}`,
        `company_name.ilike.${pattern}`,
        `primary_email.ilike.${pattern}`,
        `primary_phone.ilike.${pattern}`,
      ].join(','),
    );
  }

  const { data, count } = await query;
  return {
    rows: (data ?? []) as CustomerRow[],
    total: count ?? 0,
    page,
    pageSize: CUSTOMER_PAGE_SIZE,
  };
}

export const CUSTOMERS_EXPORT_MAX = 10_000;

const EXPORT_COLUMNS =
  'customer_type, first_name, last_name, company_name, primary_email, primary_phone, acquisition_source, created_at';

export type CustomerExportRow = {
  customer_type: CustomerType;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  acquisition_source: string | null;
  created_at: string;
};

export async function listCustomersForExport(
  filters: Omit<CustomerListFilters, 'page'>,
): Promise<CustomerExportRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from('customers')
    .select(EXPORT_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(CUSTOMERS_EXPORT_MAX);

  if (filters.type) query = query.eq('customer_type', filters.type);
  if (filters.created_from)
    query = query.gte('created_at', `${filters.created_from}T00:00:00.000Z`);
  if (filters.created_to) query = query.lte('created_at', `${filters.created_to}T23:59:59.999Z`);
  if (filters.q) {
    const safe = filters.q.replace(/[%_,]/g, ' ');
    const pattern = `%${safe}%`;
    query = query.or(
      [
        `first_name.ilike.${pattern}`,
        `last_name.ilike.${pattern}`,
        `company_name.ilike.${pattern}`,
        `primary_email.ilike.${pattern}`,
        `primary_phone.ilike.${pattern}`,
      ].join(','),
    );
  }

  const { data } = await query;
  return (data ?? []) as CustomerExportRow[];
}

export type CustomerOption = { id: string; label: string };

// Lightweight {id, label} list for picking a customer in a native <select>
// (e.g. opening a storage rental). Capped; ordered by most-recent so the
// likely-relevant customers surface first.
export const CUSTOMER_OPTIONS_MAX = 1000;

export async function listCustomerOptions(): Promise<CustomerOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('customers')
    .select('id, customer_type, first_name, last_name, company_name, primary_email')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(CUSTOMER_OPTIONS_MAX);
  return ((data ?? []) as CustomerRow[]).map((c) => ({
    id: c.id,
    label: customerDisplayName(c),
  }));
}

export async function getCustomerById(id: string): Promise<CustomerRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('customers')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as CustomerRow | null) ?? null;
}

export type CustomerJobRow = {
  id: string;
  job_number: string;
  stage: string;
  move_date: string | null;
  quote_total_pence: number | null;
  acquisition_source: string | null;
  created_at: string;
};

export async function getCustomerJobs(customerId: string, limit = 25): Promise<CustomerJobRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('jobs')
    .select('id, job_number, stage, move_date, quote_total_pence, acquisition_source, created_at')
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as CustomerJobRow[];
}

export async function getCustomerLifetimeValuePence(customerId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('customer_lifetime_value', { p_customer_id: customerId });
  if (typeof data === 'number') return data;
  if (typeof data === 'string') return Number.parseInt(data, 10) || 0;
  return 0;
}

export async function findDuplicateCandidates(args: {
  email?: string | null;
  phone?: string | null;
}): Promise<CustomerRow[]> {
  if (!args.email && !args.phone) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc('find_duplicate_candidates', {
    p_email: args.email ?? null,
    p_phone: args.phone ?? null,
    p_postcode: null,
  });
  return (data ?? []) as CustomerRow[];
}
