'use client';

import {
  INITIAL_PRICING_STATE,
  type PricingActionState,
  editPricingMatrix,
} from '@/lib/actions/pricing';
import { MATRIX_COLS, MATRIX_ROWS, marginFieldName } from '@/lib/pricing/form';
import type { PricingConfig } from '@/lib/schemas/pricing';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

interface MatrixFormProps {
  active: { version_label: string; config: PricingConfig };
}

export function PricingMatrixForm({ active }: MatrixFormProps) {
  const t = useTranslations('pricing');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<PricingActionState, FormData>(
    editPricingMatrix,
    INITIAL_PRICING_STATE,
  );
  const c = active.config;
  const rows = c.size_categories.slice(0, MATRIX_ROWS);
  const cols = c.distance_bands.slice(0, MATRIX_COLS);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-md border p-6">
        <label className="flex flex-col gap-1 text-sm">
          {t('label')}
          <input
            type="text"
            name="version_label"
            defaultValue={active.version_label}
            required
            className="rounded-md border px-3 py-2"
          />
        </label>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-[var(--color-muted-foreground)]">
                <th className="py-2 pr-4">{t('matrixSizeColumn')}</th>
                {cols.map((band) => (
                  <th key={band.code} className="py-2 pr-4">
                    {band.code}
                    <span className="ml-1 text-xs">
                      ({band.miles_min}–{band.miles_max}mi)
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((size, rowIdx) => (
                <tr key={size.code} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 font-medium">
                    {size.label}
                    <span className="ml-1 text-xs text-[var(--color-muted-foreground)]">
                      · {size.crew_size}p · {size.estimated_hours}h
                    </span>
                  </td>
                  {cols.map((band, colIdx) => {
                    const cell = c.margin_matrix[rowIdx]?.[colIdx] ?? 0;
                    return (
                      <td key={`${size.code}-${band.code}`} className="py-2 pr-4">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            name={marginFieldName(rowIdx, colIdx)}
                            defaultValue={(cell * 100).toFixed(2)}
                            step="0.01"
                            min={0}
                            max={100}
                            required
                            className="w-20 rounded-md border px-2 py-1 text-right"
                          />
                          <span className="text-[var(--color-muted-foreground)]">%</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-[var(--color-muted-foreground)]">{t('matrixHelp')}</p>

        <label className="flex flex-col gap-1 text-sm">
          {t('changeNotes')}
          <textarea
            name="notes"
            rows={3}
            placeholder={t('changeNotesPlaceholder')}
            className="rounded-md border px-3 py-2"
          />
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
        >
          {pending ? tc('loading') : t('publishVersion')}
        </button>
        {state.status === 'error' && <p className="text-sm text-red-600">{state.message}</p>}
      </div>
    </form>
  );
}
