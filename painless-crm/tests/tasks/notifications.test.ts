import { getEvent, isEventKey } from '@/lib/notifications/events';
import { describe, expect, it } from 'vitest';

// Phase 27 follow-up (ADR-042) — the unified-tasks notification events.
describe('task notification events', () => {
  it('registers task.assigned/due/overdue in the catalog', () => {
    for (const key of ['task.assigned', 'task.due', 'task.overdue']) {
      expect(isEventKey(key)).toBe(true);
    }
  });

  it('task events are targeted (one intrinsic recipient: the assignee)', () => {
    for (const key of ['task.assigned', 'task.due', 'task.overdue']) {
      expect(getEvent(key)?.scope).toBe('targeted');
      expect(getEvent(key)?.group).toBe('ops');
    }
  });

  it('task.assigned defaults to immediate; due/overdue to daily', () => {
    expect(getEvent('task.assigned')?.defaultFreq).toBe('immediate');
    expect(getEvent('task.due')?.defaultFreq).toBe('daily');
    expect(getEvent('task.overdue')?.defaultFreq).toBe('daily');
  });
});
