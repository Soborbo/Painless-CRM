// Phase 09 §time entries (deliverable #8). The job-progress steps a crew records
// after clocking in, in order. Clock-in has its own GPS flow; these are the
// plain progression markers. Pure: fold the recorded entries into the ordered
// step list the job page renders.

export const TIME_ENTRY_STEPS = [
  'load_start',
  'load_end',
  'unload_start',
  'unload_end',
  'clock_out',
] as const;
export type TimeEntryStep = (typeof TIME_ENTRY_STEPS)[number];

export function isTimeEntryStep(value: unknown): value is TimeEntryStep {
  return typeof value === 'string' && (TIME_ENTRY_STEPS as readonly string[]).includes(value);
}

export interface RecordedEntry {
  type: string | null;
  occurred_at: string;
}

export interface StepState {
  type: TimeEntryStep;
  recordedAt: string | null;
}

// Ordered step list with the earliest recorded timestamp for each (a step is
// "done" once any entry of that type exists for the day).
export function buildStepStates(recorded: readonly RecordedEntry[]): StepState[] {
  const earliest = new Map<string, string>();
  for (const r of recorded) {
    if (!r.type) continue;
    const prev = earliest.get(r.type);
    if (!prev || r.occurred_at < prev) earliest.set(r.type, r.occurred_at);
  }
  return TIME_ENTRY_STEPS.map((type) => ({ type, recordedAt: earliest.get(type) ?? null }));
}

// The next step the crew would log (first not-yet-recorded), or null if all done.
export function nextStep(states: readonly StepState[]): TimeEntryStep | null {
  return states.find((s) => s.recordedAt === null)?.type ?? null;
}
