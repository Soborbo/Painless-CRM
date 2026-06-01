import { summariseWorkerPerformance } from '@/lib/workers/performance';
import { describe, expect, it } from 'vitest';

describe('summariseWorkerPerformance', () => {
  it('returns zeroed counts for no assignments', () => {
    const p = summariseWorkerPerformance([]);
    expect(p.totalAssignments).toBe(0);
    expect(p.distinctJobs).toBe(0);
    expect(p.byRole).toEqual({ lead_loader: 0, loader: 0, driver: 0, surveyor: 0 });
  });

  it('counts total assignments, distinct jobs and roles', () => {
    const p = summariseWorkerPerformance([
      { job_id: 'j1', role: 'driver' },
      { job_id: 'j1', role: 'lead_loader' }, // same job, different role
      { job_id: 'j2', role: 'loader' },
      { job_id: 'j3', role: 'driver' },
    ]);
    expect(p.totalAssignments).toBe(4);
    expect(p.distinctJobs).toBe(3);
    expect(p.byRole.driver).toBe(2);
    expect(p.byRole.lead_loader).toBe(1);
    expect(p.byRole.loader).toBe(1);
    expect(p.byRole.surveyor).toBe(0);
  });

  it('ignores unknown / null roles but still counts the assignment + job', () => {
    const p = summariseWorkerPerformance([
      { job_id: 'j1', role: null },
      { job_id: 'j2', role: 'manager' },
    ]);
    expect(p.totalAssignments).toBe(2);
    expect(p.distinctJobs).toBe(2);
    expect(p.byRole).toEqual({ lead_loader: 0, loader: 0, driver: 0, surveyor: 0 });
  });
});
