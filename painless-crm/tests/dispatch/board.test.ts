import { type BoardAssignment, assembleBoard, deriveBadges } from '@/lib/dispatch/board';
import { enumerateDates } from '@/lib/rota/dates';
import { describe, expect, it } from 'vitest';

function asg(over: Partial<BoardAssignment>): BoardAssignment {
  return {
    job_id: 'j1',
    job_number: 'PR-1',
    customer_name: 'Acme',
    stage: 'confirmed',
    date: '2026-06-01',
    worker_id: 'w1',
    worker_name: 'Worker One',
    vehicle_id: 'v1',
    vehicle_registration: 'AB12 CDE',
    role: 'driver',
    scheduled_start: '08:00:00',
    scheduled_end: '12:00:00',
    ...over,
  };
}

const WEEK = enumerateDates('2026-06-01', 7);

describe('deriveBadges', () => {
  it('flags awaiting payment for completed/invoiced only', () => {
    expect(deriveBadges('completed').awaitingPayment).toBe(true);
    expect(deriveBadges('invoiced').awaitingPayment).toBe(true);
    expect(deriveBadges('paid').awaitingPayment).toBe(false);
    expect(deriveBadges('confirmed').awaitingPayment).toBe(false);
  });
  it('flags follow-up call for quoted only', () => {
    expect(deriveBadges('quoted').needsFollowUpCall).toBe(true);
    expect(deriveBadges('confirmed').needsFollowUpCall).toBe(false);
  });
});

describe('assembleBoard — staff lanes', () => {
  it('places an assignment in the right lane and date cell', () => {
    const board = assembleBoard([asg({})], [{ id: 'w1', label: 'Worker One' }], WEEK, 'staff');
    const lane = board.lanes.find((l) => l.laneId === 'w1');
    expect(lane?.total).toBe(1);
    const cell = lane?.cells.find((c) => c.date === '2026-06-01');
    expect(cell?.slots[0]?.job_number).toBe('PR-1');
    // other dates are empty
    expect(lane?.cells.find((c) => c.date === '2026-06-02')?.slots).toEqual([]);
  });

  it('keeps empty lanes from the option list', () => {
    const board = assembleBoard(
      [],
      [
        { id: 'w1', label: 'Aaron' },
        { id: 'w2', label: 'Zoe' },
      ],
      WEEK,
      'staff',
    );
    expect(board.lanes.map((l) => l.laneLabel)).toEqual(['Aaron', 'Zoe']);
    expect(board.lanes.every((l) => l.total === 0)).toBe(true);
  });

  it('backfills a lane that only exists in the data (e.g. inactive worker)', () => {
    const board = assembleBoard(
      [asg({ worker_id: 'wX', worker_name: 'Ghost' })],
      [], // no option lanes provided
      WEEK,
      'staff',
    );
    expect(board.lanes.map((l) => l.laneId)).toEqual(['wX']);
    expect(board.lanes[0]?.total).toBe(1);
  });

  it('groups multiple assignments on the same day and sorts by start time', () => {
    const board = assembleBoard(
      [
        asg({ job_number: 'PR-2', scheduled_start: '13:00:00' }),
        asg({ job_number: 'PR-1', scheduled_start: '08:00:00' }),
        asg({ job_number: 'PR-3', scheduled_start: null }),
      ],
      [{ id: 'w1', label: 'Worker One' }],
      WEEK,
      'staff',
    );
    const cell = board.lanes[0]?.cells.find((c) => c.date === '2026-06-01');
    expect(cell?.slots.map((s) => s.job_number)).toEqual(['PR-1', 'PR-2', 'PR-3']);
  });

  it('drops assignments outside the date window', () => {
    const board = assembleBoard(
      [asg({ date: '2026-07-01' })],
      [{ id: 'w1', label: 'Worker One' }],
      WEEK,
      'staff',
    );
    expect(board.lanes[0]?.total).toBe(0);
  });
});

describe('assembleBoard — vehicle lanes', () => {
  it('groups by vehicle and skips unvehicled assignments', () => {
    const board = assembleBoard(
      [
        asg({ vehicle_id: 'v1', vehicle_registration: 'AB12 CDE' }),
        asg({ vehicle_id: null, vehicle_registration: null }),
      ],
      [{ id: 'v1', label: 'AB12 CDE' }],
      WEEK,
      'vehicle',
    );
    expect(board.lanes).toHaveLength(1);
    expect(board.lanes[0]?.laneId).toBe('v1');
    expect(board.lanes[0]?.total).toBe(1);
  });
});
