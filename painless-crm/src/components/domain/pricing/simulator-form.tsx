'use client';

import {
  INITIAL_SIMULATION_STATE,
  type SimulationState,
  simulateQuote,
} from '@/lib/actions/pricing';
import type { PricingConfig } from '@/lib/schemas/pricing';
import { formatPence } from '@/lib/utils/format';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

interface SimulatorOptions {
  size_categories: PricingConfig['size_categories'];
  complications: PricingConfig['complications'];
  modulation_sources: PricingConfig['modulation_sources'];
  version_label: string;
}

export function SimulatorForm({ options }: { options: SimulatorOptions }) {
  const t = useTranslations('pricing');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<SimulationState, FormData>(
    simulateQuote,
    INITIAL_SIMULATION_STATE,
  );

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <form action={formAction} className="flex flex-col gap-4 rounded-md border p-6">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('simulatorAgainst')} {options.version_label}
        </p>

        <label className="flex flex-col gap-1 text-sm">
          {t('sizeCode')}
          <select
            name="size_code"
            defaultValue={options.size_categories[0]?.code ?? ''}
            className="rounded-md border px-3 py-2"
            required
          >
            {options.size_categories.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t('distanceMiles')}
          <input
            type="number"
            name="distance_miles"
            min={0}
            max={2000}
            defaultValue={10}
            className="rounded-md border px-3 py-2"
            required
          />
        </label>

        <fieldset className="flex flex-col gap-1 text-sm">
          <legend>{t('complicationsLabel')}</legend>
          <select
            name="complications"
            multiple
            className="h-32 rounded-md border px-3 py-2"
            aria-label={t('complicationsHelp')}
          >
            {options.complications.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label} (+{c.points})
              </option>
            ))}
          </select>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {t('complicationsHelp')}
          </span>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          {t('source')}
          <select name="source" defaultValue="" className="rounded-md border px-3 py-2">
            <option value="">—</option>
            {(options.modulation_sources ?? []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md border bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
        >
          {pending ? tc('loading') : t('runSimulation')}
        </button>

        {state.status === 'error' && <p className="text-sm text-red-600">{state.message}</p>}
      </form>

      <SimulationResult state={state} t={t} />
    </div>
  );
}

function SimulationResult({
  state,
  t,
}: {
  state: SimulationState;
  t: ReturnType<typeof useTranslations>;
}) {
  if (state.status !== 'ok') {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-[var(--color-muted-foreground)]">
        {t('simulatorEmpty')}
      </div>
    );
  }
  const { result } = state;
  const { breakdown, components } = result;
  return (
    <div className="flex flex-col gap-4 rounded-md border p-6">
      <header className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{formatPence(result.total_pence)}</h3>
        <span className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {breakdown.size_label} · {breakdown.distance_band_code}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <Row label={t('hours')} value={`${breakdown.estimated_hours}h`} />
        <Row label={t('crewSize')} value={String(breakdown.crew_size)} />
        <Row label={t('marginPct')} value={`${(breakdown.margin_pct * 100).toFixed(1)}%`} />
        <Row label={t('crewCost')} value={formatPence(components.crew_cost_pence)} />
        <Row label={t('vanCost')} value={formatPence(components.van_cost_pence)} />
        <Row label={t('marginPence')} value={formatPence(result.margin_pence)} />
        <Row label={t('fuel')} value={formatPence(components.fuel_pence)} />
        <Row label={t('insurance')} value={formatPence(components.insurance_pence)} />
        {components.waste_pence > 0 && (
          <Row label={t('waste')} value={formatPence(components.waste_pence)} />
        )}
        <Row label={t('passThrough')} value={formatPence(result.pass_through_pence)} />
      </dl>

      {result.requires_survey && (
        <p className="rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          {t('surveyRequired')}
        </p>
      )}
      {breakdown.margin_modulated && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {t('modulatedNote', { band: breakdown.capacity_band ?? '' })}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </>
  );
}
