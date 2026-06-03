'use client';

import {
  type CubicItemActionState,
  addCubicItem,
  removeCubicItem,
} from '@/lib/actions/cubic-items';
import type { CubicSummary } from '@/lib/jobs/cubic';
import type { CubicItem } from '@/lib/queries/surveys';
import { useActionState } from 'react';

const INITIAL: CubicItemActionState = { status: 'idle' };

export function CubicSheet({
  surveyId,
  items,
  summary,
  presets = [],
}: {
  surveyId: string;
  items: CubicItem[];
  summary: CubicSummary;
  presets?: { name: string; cubic_ft: number }[];
}) {
  const [addState, addAction, adding] = useActionState(addCubicItem, INITIAL);
  const [, removeAction] = useActionState(removeCubicItem, INITIAL);

  return (
    <section className="rounded-md border p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Cubic sheet</h2>
        <span className="text-sm tabular-nums">
          {summary.totalCubicFt} ft³ · {summary.totalUnits} items
          {summary.fragileCount > 0 ? ` · ${summary.fragileCount} fragile` : ''}
          {summary.dismantleCount > 0 ? ` · ${summary.dismantleCount} to dismantle` : ''}
        </span>
      </div>

      <table className="mt-3 w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          <tr>
            <th className="py-1">Room</th>
            <th className="py-1">Item</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">ft³ each</th>
            <th className="py-1 text-right">ft³ total</th>
            <th className="py-1">Flags</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-3 text-[var(--color-muted-foreground)]">
                No items yet.
              </td>
            </tr>
          ) : (
            items.map((it) => (
              <tr key={it.id} className="border-b">
                <td className="py-1">{it.room ?? '—'}</td>
                <td className="py-1">{it.item}</td>
                <td className="py-1 text-right tabular-nums">{it.quantity ?? 1}</td>
                <td className="py-1 text-right tabular-nums">{it.cubic_ft_each ?? 0}</td>
                <td className="py-1 text-right tabular-nums">{it.cubic_ft_total ?? 0}</td>
                <td className="py-1 text-xs text-[var(--color-muted-foreground)]">
                  {[it.fragile ? 'fragile' : null, it.dismantle_required ? 'dismantle' : null]
                    .filter(Boolean)
                    .join(', ')}
                </td>
                <td className="py-1 text-right">
                  <form action={removeAction}>
                    <input type="hidden" name="id" value={it.id} />
                    <input type="hidden" name="survey_id" value={surveyId} />
                    <button
                      type="submit"
                      className="text-xs text-[var(--color-danger,#dc2626)] hover:underline"
                    >
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <form
        action={addAction}
        className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 text-sm md:grid-cols-6"
      >
        <input type="hidden" name="survey_id" value={surveyId} />
        <input name="room" placeholder="Room" className="rounded-md border px-2 py-1" />
        <input
          name="item"
          placeholder="Item *"
          required
          list={presets.length > 0 ? 'cubic-presets' : undefined}
          onChange={(e) => {
            const match = presets.find(
              (p) => p.name.toLowerCase() === e.target.value.toLowerCase(),
            );
            if (!match) return;
            const vol = e.currentTarget.form?.elements.namedItem(
              'cubic_ft_each',
            ) as HTMLInputElement | null;
            if (vol && !vol.value) vol.value = String(match.cubic_ft);
          }}
          className="rounded-md border px-2 py-1 md:col-span-2"
        />
        {presets.length > 0 ? (
          <datalist id="cubic-presets">
            {presets.map((p) => (
              <option key={p.name} value={p.name} />
            ))}
          </datalist>
        ) : null}
        <input
          name="quantity"
          type="number"
          min={1}
          defaultValue={1}
          placeholder="Qty"
          className="rounded-md border px-2 py-1"
        />
        <input
          name="cubic_ft_each"
          type="number"
          step="any"
          min={0}
          placeholder="ft³ each *"
          required
          className="rounded-md border px-2 py-1"
        />
        <button
          type="submit"
          disabled={adding}
          className="rounded-md border bg-[var(--color-primary)] px-3 py-1 font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
        <label className="flex items-center gap-1 md:col-span-3">
          <input type="checkbox" name="fragile" className="h-4 w-4" /> Fragile
        </label>
        <label className="flex items-center gap-1 md:col-span-3">
          <input type="checkbox" name="dismantle_required" className="h-4 w-4" /> Needs dismantling
        </label>
      </form>
      {addState.status === 'error' ? (
        <p className="mt-2 text-xs text-[var(--color-danger,#dc2626)]">{addState.message}</p>
      ) : null}
    </section>
  );
}
