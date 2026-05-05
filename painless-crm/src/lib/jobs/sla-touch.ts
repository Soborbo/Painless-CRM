import type { JobStage } from '@/lib/jobs/state-machine';

// Pure decision: should logging contact at `occurredAt` be treated as the
// job's first response? It only counts when the job is still in lead/contacted
// AND `first_response_at` hasn't been set. Phase 06b §4 wires this into the
// manual-call-log flow so the SLA dashboard clears as soon as a call is logged.

export const SLA_RESPONSIVE_STAGES: readonly JobStage[] = ['lead', 'contacted'];

export interface SlaTouchInput {
  stage: JobStage;
  firstResponseAt: string | null;
  occurredAt: string;
}

export function shouldRecordFirstResponse(input: SlaTouchInput): boolean {
  if (input.firstResponseAt) return false;
  if (!SLA_RESPONSIVE_STAGES.includes(input.stage)) return false;
  if (Number.isNaN(Date.parse(input.occurredAt))) return false;
  return true;
}
