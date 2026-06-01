import { extractVariables, renderTemplate } from '@/lib/comms/render';
import { describe, expect, it } from 'vitest';

describe('renderTemplate', () => {
  it('substitutes variables, tolerating inner whitespace', () => {
    expect(
      renderTemplate('Hi {{name}}, job {{ job_number }}', { name: 'Jane', job_number: 'J2026-1' }),
    ).toBe('Hi Jane, job J2026-1');
  });

  it('renders unknown or null variables as empty string (never leaks {{ }})', () => {
    expect(renderTemplate('A {{missing}} B', {})).toBe('A  B');
    expect(renderTemplate('A {{x}} B', { x: null })).toBe('A  B');
  });

  it('coerces numbers', () => {
    expect(renderTemplate('Total: {{total}}', { total: 1250 })).toBe('Total: 1250');
  });

  it('replaces every occurrence', () => {
    expect(renderTemplate('{{a}}-{{a}}', { a: 'x' })).toBe('x-x');
  });
});

describe('extractVariables', () => {
  it('lists distinct variables in first-seen order', () => {
    expect(extractVariables('{{a}} {{b}} {{a}} {{ c }}')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty for a plain string', () => {
    expect(extractVariables('no variables here')).toEqual([]);
  });
});
