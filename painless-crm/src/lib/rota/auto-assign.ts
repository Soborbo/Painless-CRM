// Phase 08 §Rota — crew auto-assignment. Pure load-balanced round-robin that
// mirrors the lead router in lib/jobs/routing.ts, but for booking a worker onto
// a job on a given day. The least-busy *available* worker wins, so repeated
// auto-assigns spread the work evenly instead of always picking the same name.
// Availability (who is already booked / conflicts) is decided by the caller and
// passed in as `unavailableWorkerIds`, keeping this function deterministic and
// trivially testable.

export type WorkerOption = { id: string; full_name: string };
export type WorkerLoad = { worker_id: string; count: number };

// Picks the least-busy worker not in `unavailableWorkerIds`, or null when none
// are free. Ties break alphabetically by name, then by id, so the result is
// stable across calls (no reliance on input ordering).
export function pickNextWorker(
  workers: readonly WorkerOption[],
  loads: readonly WorkerLoad[],
  unavailableWorkerIds: ReadonlySet<string>,
): WorkerOption | null {
  const loadOf = (id: string) => loads.find((l) => l.worker_id === id)?.count ?? 0;
  const eligible = workers.filter((w) => !unavailableWorkerIds.has(w.id));
  if (eligible.length === 0) return null;

  const ordered = [...eligible].sort((a, b) => {
    const byLoad = loadOf(a.id) - loadOf(b.id);
    if (byLoad !== 0) return byLoad;
    const byName = a.full_name.localeCompare(b.full_name);
    return byName !== 0 ? byName : a.id.localeCompare(b.id);
  });
  return ordered[0] ?? null;
}

// The window (in days, inclusive of the target date) over which a worker's
// existing bookings count toward their load. A fortnight is wide enough to even
// out the rota without letting a single busy day dominate the balance.
export const LOAD_WINDOW_DAYS = 14;
