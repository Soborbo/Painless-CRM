'use client';

import { useJobSelection } from './selection-context';

const BOX = 'h-4 w-4 cursor-pointer rounded border-[var(--color-border)]';

export function JobRowCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useJobSelection();
  return (
    <input
      type="checkbox"
      className={BOX}
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label="Select job"
    />
  );
}

export function JobSelectAllCheckbox({ ids }: { ids: string[] }) {
  const { selected, setMany } = useJobSelection();
  const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
  return (
    <input
      type="checkbox"
      className={BOX}
      checked={allOn}
      onChange={(e) => setMany(ids, e.target.checked)}
      aria-label="Select all jobs"
    />
  );
}
