import { canTransition, isTerminal } from '@/lib/damages/state-machine';
import { describe, expect, it } from 'vitest';

describe('damage-claim state machine', () => {
  it('allows the assessment path and rejections', () => {
    expect(canTransition('reported', 'investigating')).toBe(true);
    expect(canTransition('reported', 'denied')).toBe(true);
    expect(canTransition('investigating', 'agreed')).toBe(true);
    expect(canTransition('agreed', 'paid')).toBe(true);
    expect(canTransition('investigating', 'denied')).toBe(true);
  });

  it('blocks skips and exits from terminal states', () => {
    expect(canTransition('reported', 'paid')).toBe(false);
    expect(canTransition('reported', 'agreed')).toBe(false);
    expect(canTransition('paid', 'investigating')).toBe(false);
    expect(canTransition('denied', 'investigating')).toBe(false);
  });

  it('treats paid and denied as terminal', () => {
    expect(isTerminal('paid')).toBe(true);
    expect(isTerminal('denied')).toBe(true);
    expect(isTerminal('reported')).toBe(false);
    expect(isTerminal('investigating')).toBe(false);
    expect(isTerminal('agreed')).toBe(false);
  });
});
