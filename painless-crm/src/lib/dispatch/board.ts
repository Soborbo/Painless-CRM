// Phase 20 — Dispatcher Job Board assembler. Pure: it turns a flat list of
// crew/vehicle assignments into per-lane swimlanes across a date window, so it
// unit-tests directly with no I/O. The board is read-only in v1 (ADR-029);
// assignment edits stay on the job page / rota.

export type LaneType = 'staff' | 'vehicle';

// One assignment row, already joined to its job + worker + vehicle names.
export interface BoardAssignment {
  job_id: string;
  job_number: string;
  customer_name: string;
  stage: string;
  date: string; // YYYY-MM-DD
  worker_id: string;
  worker_name: string;
  vehicle_id: string | null;
  vehicle_registration: string | null;
  role: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
}

export interface BoardSlot {
  job_id: string;
  job_number: string;
  customer_name: string;
  role: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  needsFollowUpCall: boolean;
  awaitingPayment: boolean;
}

export interface BoardCell {
  date: string;
  slots: BoardSlot[];
}

export interface BoardLane {
  laneId: string;
  laneLabel: string;
  cells: BoardCell[]; // one per window date, in order
  total: number; // total slots in the window (for empty-lane styling / sort)
}

export interface DispatchBoard {
  laneType: LaneType;
  dates: string[];
  lanes: BoardLane[];
}

export interface LaneOption {
  id: string;
  label: string;
}

// Awaiting payment: the work is done but money is still owed. Follow-up call:
// a quote is out and the office should chase the decision. Both derive purely
// from the job stage so the badges need no extra query. See ADR-029.
const AWAITING_PAYMENT_STAGES = new Set(['completed', 'invoiced']);
const FOLLOW_UP_STAGES = new Set(['quoted']);

export function deriveBadges(stage: string): {
  needsFollowUpCall: boolean;
  awaitingPayment: boolean;
} {
  return {
    needsFollowUpCall: FOLLOW_UP_STAGES.has(stage),
    awaitingPayment: AWAITING_PAYMENT_STAGES.has(stage),
  };
}

function laneKey(a: BoardAssignment, laneType: LaneType): { id: string; label: string } | null {
  if (laneType === 'staff') return { id: a.worker_id, label: a.worker_name };
  if (!a.vehicle_id) return null; // unvehicled assignments have no vehicle lane
  return { id: a.vehicle_id, label: a.vehicle_registration ?? a.vehicle_id };
}

function toSlot(a: BoardAssignment): BoardSlot {
  return {
    job_id: a.job_id,
    job_number: a.job_number,
    customer_name: a.customer_name,
    role: a.role,
    scheduled_start: a.scheduled_start,
    scheduled_end: a.scheduled_end,
    ...deriveBadges(a.stage),
  };
}

// nulls sort last, then by start time, then by job number — stable within a cell.
function compareSlots(x: BoardSlot, y: BoardSlot): number {
  if (x.scheduled_start !== y.scheduled_start) {
    if (x.scheduled_start === null) return 1;
    if (y.scheduled_start === null) return -1;
    return x.scheduled_start < y.scheduled_start ? -1 : 1;
  }
  return x.job_number.localeCompare(y.job_number);
}

export function assembleBoard(
  assignments: readonly BoardAssignment[],
  lanes: readonly LaneOption[],
  dates: readonly string[],
  laneType: LaneType,
): DispatchBoard {
  // Seed labels from the provided option list so empty lanes still render, then
  // backfill any lane that only exists in the data (e.g. a now-inactive worker
  // who still has a live assignment in the window) so nothing is dropped.
  const labels = new Map<string, string>();
  for (const lane of lanes) labels.set(lane.id, lane.label);

  // slots[laneId][date] accumulates as we walk the assignments.
  const slots = new Map<string, Map<string, BoardSlot[]>>();
  const dateSet = new Set(dates);

  for (const a of assignments) {
    if (!dateSet.has(a.date)) continue;
    const key = laneKey(a, laneType);
    if (!key) continue;
    if (!labels.has(key.id)) labels.set(key.id, key.label);
    let byDate = slots.get(key.id);
    if (!byDate) {
      byDate = new Map();
      slots.set(key.id, byDate);
    }
    const cell = byDate.get(a.date) ?? [];
    cell.push(toSlot(a));
    byDate.set(a.date, cell);
  }

  const builtLanes: BoardLane[] = [...labels.entries()].map(([laneId, laneLabel]) => {
    const byDate = slots.get(laneId);
    let total = 0;
    const cells: BoardCell[] = dates.map((date) => {
      const cellSlots = (byDate?.get(date) ?? []).slice().sort(compareSlots);
      total += cellSlots.length;
      return { date, slots: cellSlots };
    });
    return { laneId, laneLabel, cells, total };
  });

  builtLanes.sort((a, b) => a.laneLabel.localeCompare(b.laneLabel));

  return { laneType, dates: [...dates], lanes: builtLanes };
}
