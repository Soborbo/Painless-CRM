import {
  VEHICLE_PAGE_SIZE,
  type VehicleListFilters,
  type VehicleType,
} from '@/lib/schemas/vehicle';
import { createClient } from '@/lib/supabase/server';

export type VehicleRow = {
  id: string;
  registration: string;
  type: VehicleType | null;
  capacity_cubic_ft: number | null;
  monthly_cost_pence: number | null;
  active: boolean;
  compliance_alerts_enabled: boolean;
  mot_due: string | null;
  tax_due: string | null;
  insurance_due: string | null;
  next_service_due: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

export type VehicleListResult = {
  rows: VehicleRow[];
  total: number;
  page: number;
  pageSize: number;
};

const COLUMNS =
  'id, registration, type, capacity_cubic_ft, monthly_cost_pence, active, compliance_alerts_enabled, mot_due, tax_due, insurance_due, next_service_due, created_at, updated_at, version';

export async function listVehicles(filters: VehicleListFilters): Promise<VehicleListResult> {
  const supabase = await createClient();
  const page = filters.page;
  const from = (page - 1) * VEHICLE_PAGE_SIZE;
  const to = from + VEHICLE_PAGE_SIZE - 1;

  let query = supabase
    .from('vehicles')
    .select(COLUMNS, { count: 'exact' })
    .is('deleted_at', null)
    .order('registration', { ascending: true })
    .range(from, to);

  if (filters.type) query = query.eq('type', filters.type);
  if (filters.active === 'active') query = query.eq('active', true);
  if (filters.active === 'inactive') query = query.eq('active', false);

  const { data, count } = await query;
  return {
    rows: (data ?? []) as VehicleRow[],
    total: count ?? 0,
    page,
    pageSize: VEHICLE_PAGE_SIZE,
  };
}

export async function getVehicleById(id: string): Promise<VehicleRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('vehicles')
    .select(COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as VehicleRow | null) ?? null;
}
