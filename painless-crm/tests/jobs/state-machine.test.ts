import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ALLOWED_BACKWARD_TRANSITIONS,
  ALLOWED_FORWARD_TRANSITIONS,
  JOB_STAGES,
  type JobStage,
  REQUIRED_FIELDS_FOR_ENTRY,
  TERMINAL_STAGES,
  classifyTransition,
  isTerminal,
} from '@/lib/jobs/state-machine';
import { describe, expect, it } from 'vitest';

const SPEC_PATH = resolve(__dirname, '../../../painless-crm-spec/STATE_MACHINE.md');
const SQL_PATH = resolve(
  __dirname,
  '../../supabase/migrations/00000000000010_phase_02_domain_schema.sql',
);

function readSqlEnum(): string[] {
  const sql = readFileSync(SQL_PATH, 'utf-8');
  const match = /create type job_stage as enum \(([\s\S]*?)\)/i.exec(sql);
  if (!match?.[1]) throw new Error('job_stage enum not found in migration');
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
}

function readSpecStages(): string[] {
  const spec = readFileSync(SPEC_PATH, 'utf-8');
  return [...spec.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1] as string);
}

describe('job state machine — compliance with STATE_MACHINE.md', () => {
  it('JOB_STAGES matches the SQL job_stage enum', () => {
    const sqlStages = readSqlEnum().sort();
    const tsStages = [...JOB_STAGES].sort();
    expect(tsStages).toEqual(sqlStages);
  });

  it('JOB_STAGES contains every stage listed in STATE_MACHINE.md §1', () => {
    const docStages = readSpecStages();
    expect(docStages.length).toBeGreaterThan(0);
    for (const stage of docStages) {
      expect(JOB_STAGES).toContain(stage as JobStage);
    }
  });

  it('TERMINAL_STAGES has no forward transitions', () => {
    for (const stage of TERMINAL_STAGES) {
      expect(ALLOWED_FORWARD_TRANSITIONS[stage]).toEqual([]);
      expect(ALLOWED_BACKWARD_TRANSITIONS[stage]).toEqual([]);
      expect(isTerminal(stage)).toBe(true);
    }
  });

  it('every stage has an entry in every transition / required-field map', () => {
    for (const stage of JOB_STAGES) {
      expect(ALLOWED_FORWARD_TRANSITIONS).toHaveProperty(stage);
      expect(ALLOWED_BACKWARD_TRANSITIONS).toHaveProperty(stage);
      expect(REQUIRED_FIELDS_FOR_ENTRY).toHaveProperty(stage);
    }
  });

  it('lead cannot jump directly to accepted (must pass through quoted)', () => {
    expect(classifyTransition('lead', 'accepted')).toBe('forbidden');
    expect(classifyTransition('lead', 'quoted')).toBe('forbidden');
    expect(classifyTransition('lead', 'contacted')).toBe('forward');
  });

  it('paid is terminal', () => {
    for (const stage of JOB_STAGES) {
      if (stage === 'paid') continue;
      expect(classifyTransition('paid', stage)).toBe('forbidden');
    }
  });

  it('cancelled cannot go back to active stages', () => {
    for (const stage of ['accepted', 'confirmed', 'in_progress', 'completed'] as JobStage[]) {
      expect(classifyTransition('cancelled', stage)).toBe('forbidden');
    }
  });

  it('backward transitions match the spec "Can revert from?" column', () => {
    expect(ALLOWED_BACKWARD_TRANSITIONS.contacted).toEqual(['lead']);
    expect(ALLOWED_BACKWARD_TRANSITIONS.survey_scheduled).toEqual(['contacted']);
    expect(ALLOWED_BACKWARD_TRANSITIONS.quoted).toEqual(['contacted', 'survey_scheduled']);
    expect(ALLOWED_BACKWARD_TRANSITIONS.accepted).toEqual(['quoted']);
    expect(ALLOWED_BACKWARD_TRANSITIONS.confirmed).toEqual(['accepted']);
  });

  it('classifyTransition rejects same-stage transitions', () => {
    for (const stage of JOB_STAGES) {
      expect(classifyTransition(stage, stage)).toBe('forbidden');
    }
  });

  it('forward transition from quoted reaches accepted', () => {
    expect(classifyTransition('quoted', 'accepted')).toBe('forward');
  });

  it('quoted requires quote_id and quote_total_pence', () => {
    expect(REQUIRED_FIELDS_FOR_ENTRY.quoted).toContain('quote_id');
    expect(REQUIRED_FIELDS_FOR_ENTRY.quoted).toContain('quote_total_pence');
  });

  it('declined requires decline_reason', () => {
    expect(REQUIRED_FIELDS_FOR_ENTRY.declined).toContain('decline_reason');
  });

  it('cancelled requires cancellation_reason and deposit_refund_decision', () => {
    expect(REQUIRED_FIELDS_FOR_ENTRY.cancelled).toContain('cancellation_reason');
    expect(REQUIRED_FIELDS_FOR_ENTRY.cancelled).toContain('deposit_refund_decision');
  });
});
