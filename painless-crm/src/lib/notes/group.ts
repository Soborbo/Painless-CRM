// Phase 19 — split job notes into the iMVE-style timelines. Pure, so it
// unit-tests directly. Legacy rows predate the explicit category choice and
// carry 'admin' or 'customer_visible'; 'staff' is new in Phase 19.

export type NoteCategory = 'admin' | 'staff' | 'customer_visible';

export const NOTE_CATEGORIES: readonly NoteCategory[] = ['admin', 'staff', 'customer_visible'];

export interface Categorisable {
  category: NoteCategory;
}

export interface GroupedNotes<T extends Categorisable> {
  admin: T[];
  staff: T[];
  customer_visible: T[];
}

export function groupNotesByCategory<T extends Categorisable>(rows: readonly T[]): GroupedNotes<T> {
  const grouped: GroupedNotes<T> = { admin: [], staff: [], customer_visible: [] };
  for (const row of rows) {
    grouped[row.category].push(row);
  }
  return grouped;
}

// Normalise a possibly-null/legacy category value to a known bucket. Anything
// unrecognised falls back to 'admin' (the most restrictive internal timeline).
export function normaliseCategory(value: string | null | undefined): NoteCategory {
  return value === 'staff' || value === 'customer_visible' ? value : 'admin';
}
