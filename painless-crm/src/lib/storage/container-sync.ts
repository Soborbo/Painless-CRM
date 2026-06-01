import type { ContainerStatus } from '@/lib/storage/occupancy';
import type { createClient } from '@/lib/supabase/server';

// Helpers shared by the rental actions for reading a container and writing back
// its projected status (ADR-023). Not a 'use server' module — plain functions
// that take an already-resolved client, so they can sit beside the actions
// without each becoming its own Server Action.

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type ContainerRow = {
  id: string;
  status: string | null;
  version: number;
  storage_site_id: string;
};

export async function fetchContainer(
  supabase: ServerClient,
  containerId: string,
): Promise<ContainerRow | null> {
  const { data } = await supabase
    .from('storage_containers')
    .select('id, status, version, storage_site_id')
    .eq('id', containerId)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as ContainerRow | null) ?? null;
}

// Project the new container status, guarding on its version so a concurrent
// edit can't be silently clobbered. Returns false on a version clash.
export async function setContainerStatus(
  supabase: ServerClient,
  containerId: string,
  status: ContainerStatus,
  version: number,
): Promise<boolean> {
  const { data } = await supabase
    .from('storage_containers')
    .update({ status, version: version + 1, updated_at: new Date().toISOString() })
    .eq('id', containerId)
    .eq('version', version)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  return Boolean(data);
}
