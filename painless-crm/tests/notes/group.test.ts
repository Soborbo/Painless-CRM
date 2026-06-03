import { groupNotesByCategory, normaliseCategory } from '@/lib/notes/group';
import { describe, expect, it } from 'vitest';

describe('groupNotesByCategory', () => {
  it('splits rows into the three timelines preserving order', () => {
    const rows = [
      { id: 'a', category: 'admin' as const },
      { id: 'b', category: 'staff' as const },
      { id: 'c', category: 'customer_visible' as const },
      { id: 'd', category: 'admin' as const },
    ];
    const grouped = groupNotesByCategory(rows);
    expect(grouped.admin.map((r) => r.id)).toEqual(['a', 'd']);
    expect(grouped.staff.map((r) => r.id)).toEqual(['b']);
    expect(grouped.customer_visible.map((r) => r.id)).toEqual(['c']);
  });

  it('returns empty buckets for an empty input', () => {
    expect(groupNotesByCategory([])).toEqual({ admin: [], staff: [], customer_visible: [] });
  });
});

describe('normaliseCategory', () => {
  it('passes through known categories', () => {
    expect(normaliseCategory('admin')).toBe('admin');
    expect(normaliseCategory('staff')).toBe('staff');
    expect(normaliseCategory('customer_visible')).toBe('customer_visible');
  });

  it('falls back to admin for null / legacy / unknown values', () => {
    expect(normaliseCategory(null)).toBe('admin');
    expect(normaliseCategory(undefined)).toBe('admin');
    expect(normaliseCategory('weird')).toBe('admin');
  });
});
