// Round-robin routing for incoming leads.
// v0.1: pure round-robin, capacity-capped at MAX_ACTIVE_LEADS per rep.
// Phase 8 will upgrade to signal-driven (best conversion rate).

export const MAX_ACTIVE_LEADS_PER_REP = 20;
const ACTIVE_STAGES = ['lead', 'contacted', 'survey_scheduled', 'quoted'] as const;

export type SalesRep = {
  id: string;
  full_name: string;
  active: boolean;
};

export type RepLoad = {
  rep_id: string;
  active_count: number;
};

export function pickNextRep(
  reps: readonly SalesRep[],
  loads: readonly RepLoad[],
  lastAssignedRepId: string | null,
): SalesRep | null {
  const eligible = reps
    .filter((r) => r.active)
    .filter((r) => {
      const load = loads.find((l) => l.rep_id === r.id)?.active_count ?? 0;
      return load < MAX_ACTIVE_LEADS_PER_REP;
    });
  if (eligible.length === 0) return null;

  const ordered = [...eligible].sort((a, b) => a.id.localeCompare(b.id));
  if (!lastAssignedRepId) return ordered[0] ?? null;

  const lastIndex = ordered.findIndex((r) => r.id === lastAssignedRepId);
  if (lastIndex === -1) return ordered[0] ?? null;

  return ordered[(lastIndex + 1) % ordered.length] ?? null;
}

export { ACTIVE_STAGES };
