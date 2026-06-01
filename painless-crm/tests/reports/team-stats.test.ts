import { aggregateTeamStats } from '@/lib/reports/team-stats';
import { describe, expect, it } from 'vitest';

const names = new Map([
  ['w1', 'Alice'],
  ['w2', 'Bob'],
]);

describe('aggregateTeamStats', () => {
  it('rolls reviews, complaints, damages and avg rating to the sign-off owner', () => {
    const signoffs = [
      { worker_id: 'w1', job_id: 'j1', internal_rating_1_5: 5, review_clicked: true },
      { worker_id: 'w1', job_id: 'j2', internal_rating_1_5: 3, review_clicked: false },
      { worker_id: 'w2', job_id: 'j3', internal_rating_1_5: null, review_clicked: true },
    ];
    const stats = aggregateTeamStats(signoffs, ['j1'], ['j2', 'j3'], names);

    const alice = stats.find((s) => s.worker_id === 'w1');
    expect(alice).toMatchObject({
      worker_name: 'Alice',
      jobs: 2,
      reviews: 1,
      complaints: 1,
      damages: 1,
      avg_rating: 4,
    });

    const bob = stats.find((s) => s.worker_id === 'w2');
    expect(bob).toMatchObject({ jobs: 1, reviews: 1, complaints: 0, damages: 1, avg_rating: null });
  });

  it('ignores complaints/damages on jobs with no sign-off owner', () => {
    const signoffs = [
      { worker_id: 'w1', job_id: 'j1', internal_rating_1_5: 4, review_clicked: false },
    ];
    const stats = aggregateTeamStats(signoffs, ['unknown-job'], [], names);
    expect(stats).toHaveLength(1);
    expect(stats[0]?.complaints).toBe(0);
  });

  it('skips sign-offs with no worker and sorts by name', () => {
    const signoffs = [
      { worker_id: null, job_id: 'j0', internal_rating_1_5: 1, review_clicked: false },
      { worker_id: 'w2', job_id: 'j3', internal_rating_1_5: 2, review_clicked: false },
      { worker_id: 'w1', job_id: 'j1', internal_rating_1_5: 2, review_clicked: false },
    ];
    const stats = aggregateTeamStats(signoffs, [], [], names);
    expect(stats.map((s) => s.worker_name)).toEqual(['Alice', 'Bob']);
  });
});
