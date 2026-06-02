import type { StorageRentalRow } from '@/lib/reports/storage';
import { createClient } from '@/lib/supabase/server';
import { customerDisplayName } from '@/lib/utils/format';

export type RentalRow = {
  id: string;
  customer_id: string;
  customer_name: string;
  start_date: string;
  end_date: string | null;
  monthly_rate_pence: number;
  status: string | null;
  notes: string | null;
  created_at: string;
  version: number;
};

const RENTAL_COLUMNS = `
  id, customer_id, start_date, end_date, monthly_rate_pence, status, notes, created_at, version,
  customer:customers (customer_type, first_name, last_name, company_name, primary_email)
`;

function embedOne<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return (raw as T | null) ?? null;
}

function mapRental(raw: Record<string, unknown>): RentalRow {
  const customer = embedOne<{
    customer_type: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    primary_email: string | null;
  }>(raw.customer);
  return {
    id: raw.id as string,
    customer_id: raw.customer_id as string,
    customer_name: customer ? customerDisplayName(customer) : 'Unknown customer',
    start_date: raw.start_date as string,
    end_date: (raw.end_date as string | null) ?? null,
    monthly_rate_pence: raw.monthly_rate_pence as number,
    status: (raw.status as string | null) ?? null,
    notes: (raw.notes as string | null) ?? null,
    created_at: raw.created_at as string,
    version: raw.version as number,
  };
}

// Storage report read (Phase 14). Every non-deleted rental with just the
// columns the MRR/churn aggregator needs; RLS scopes it to the company. The
// snapshot fields (status) give live MRR; start/end dates drive movement.
export async function listRentalsForReport(): Promise<StorageRentalRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('storage_rentals')
    .select('status, monthly_rate_pence, start_date, end_date')
    .is('deleted_at', null)
    .limit(5000);
  return (data ?? []) as StorageRentalRow[];
}

// All rentals for a container, newest first. Used on the container detail page
// for the history + the current occupant.
export async function listRentalsForContainer(containerId: string): Promise<RentalRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('storage_rentals')
    .select(RENTAL_COLUMNS)
    .eq('storage_container_id', containerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapRental);
}
