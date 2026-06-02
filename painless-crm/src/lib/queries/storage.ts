import { type OccupancySummary, summariseOccupancy } from '@/lib/storage/occupancy';
import { createClient } from '@/lib/supabase/server';

export type StorageSiteRow = {
  id: string;
  name: string;
  total_containers: number | null;
  active: boolean;
  notes: string | null;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    postcode: string;
  } | null;
};

export type StorageSiteWithOccupancy = StorageSiteRow & { occupancy: OccupancySummary };

export type StorageContainerRow = {
  id: string;
  storage_site_id: string;
  container_code: string;
  size_cubic_ft: number | null;
  monthly_rate_pence: number;
  status: string | null;
  notes: string | null;
  updated_at: string;
  version: number;
};

const SITE_COLUMNS =
  'id, name, total_containers, active, notes, address:addresses (line1, line2, city, postcode)';
const CONTAINER_COLUMNS =
  'id, storage_site_id, container_code, size_cubic_ft, monthly_rate_pence, status, notes, updated_at, version';

function embedOne<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return (raw as T | null) ?? null;
}

function mapSite(raw: Record<string, unknown>): StorageSiteRow {
  return {
    id: raw.id as string,
    name: raw.name as string,
    total_containers: (raw.total_containers as number | null) ?? null,
    active: raw.active as boolean,
    notes: (raw.notes as string | null) ?? null,
    address: embedOne<StorageSiteRow['address']>(raw.address),
  };
}

export async function listStorageSites(): Promise<StorageSiteWithOccupancy[]> {
  const supabase = await createClient();
  const { data: siteRows } = await supabase
    .from('storage_sites')
    .select(SITE_COLUMNS)
    .order('name', { ascending: true });
  const sites = ((siteRows ?? []) as Array<Record<string, unknown>>).map(mapSite);
  if (sites.length === 0) return [];

  const { data: containerRows } = await supabase
    .from('storage_containers')
    .select('storage_site_id, status')
    .is('deleted_at', null)
    .in(
      'storage_site_id',
      sites.map((s) => s.id),
    );

  const statusesBySite = new Map<string, (string | null)[]>();
  for (const row of (containerRows ?? []) as Array<{
    storage_site_id: string;
    status: string | null;
  }>) {
    const list = statusesBySite.get(row.storage_site_id) ?? [];
    list.push(row.status);
    statusesBySite.set(row.storage_site_id, list);
  }

  return sites.map((site) => ({
    ...site,
    occupancy: summariseOccupancy(statusesBySite.get(site.id) ?? []),
  }));
}

// Every container's status across all sites — for the company-wide occupancy
// figure on the storage report. RLS scopes it to the company.
export async function listAllContainerStatuses(): Promise<(string | null)[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('storage_containers')
    .select('status')
    .is('deleted_at', null)
    .limit(5000);
  return ((data ?? []) as Array<{ status: string | null }>).map((r) => r.status);
}

export async function getStorageSite(id: string): Promise<StorageSiteRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('storage_sites')
    .select(SITE_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  return data ? mapSite(data as Record<string, unknown>) : null;
}

export async function listContainers(siteId: string): Promise<StorageContainerRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('storage_containers')
    .select(CONTAINER_COLUMNS)
    .eq('storage_site_id', siteId)
    .is('deleted_at', null)
    .order('container_code', { ascending: true });
  return (data ?? []) as StorageContainerRow[];
}

export async function getContainer(id: string): Promise<StorageContainerRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('storage_containers')
    .select(CONTAINER_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as StorageContainerRow | null) ?? null;
}
