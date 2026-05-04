'use client';

import {
  INITIAL_PRICING_STATE,
  type PricingActionState,
  editPricingScalars,
} from '@/lib/actions/pricing';
import type { PricingConfig } from '@/lib/schemas/pricing';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

interface EditFormProps {
  active: { version_label: string; config: PricingConfig };
}

export function PricingEditForm({ active }: EditFormProps) {
  const t = useTranslations('pricing');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<PricingActionState, FormData>(
    editPricingScalars,
    INITIAL_PRICING_STATE,
  );
  const c = active.config;
  const pt = c.pass_through_config;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-md border p-6">
        <h2 className="text-lg font-medium">{t('editScalarsTitle')}</h2>

        <Field label={t('label')} name="version_label" defaultValue={c.version_label} required />

        <div className="grid gap-4 md:grid-cols-2">
          <NumberField
            label={t('crewHourly')}
            name="crew_hourly_rate_pence"
            defaultValue={c.crew_hourly_rate_pence}
            min={0}
          />
          <NumberField
            label={t('vanHourly')}
            name="van_hourly_rate_pence"
            defaultValue={c.van_hourly_rate_pence}
            min={0}
          />
          <NumberField
            label={t('fuelPerMile')}
            name="fuel_per_mile_pence"
            defaultValue={pt.fuel_per_mile_pence}
            min={0}
          />
          <NumberField
            label={t('insurancePerJob')}
            name="insurance_per_job_pence"
            defaultValue={pt.insurance_per_job_pence}
            min={0}
          />
          <NumberField
            label={t('wasteFixed')}
            name="waste_disposal_fixed_pence"
            defaultValue={pt.waste_disposal_fixed_pence ?? ''}
            min={0}
            optional
          />
          <NumberField
            label={t('quoteValidityDays')}
            name="quote_validity_days"
            defaultValue={c.quote_validity_days}
            min={1}
            max={365}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="dynamic_pricing_enabled"
            defaultChecked={c.dynamic_pricing_enabled}
          />
          {t('dynamicPricing')}
        </label>

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

      <section className="flex flex-col gap-3 rounded-md border border-dashed p-6 text-sm text-[var(--color-muted-foreground)]">
        <p className="font-medium text-[var(--color-foreground)]">{t('inheritedFromActive')}</p>
        <p>{t('matrixSize', { size: 5, distance: 3 })}</p>
        <p>
          {t('sizeCategoriesCount', {
            count: c.size_categories.length,
          })}
        </p>
        <p>
          {t('complicationsCount', {
            count: c.complications.length,
          })}
        </p>
        <p>
          {t('distanceBandsCount', {
            count: c.distance_bands.length,
          })}
        </p>
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

function Field({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="rounded-md border px-3 py-2"
      />
    </label>
  );
}

function NumberField({
  label,
  name,
  defaultValue,
  min,
  max,
  optional,
}: {
  label: string;
  name: string;
  defaultValue: number | string;
  min?: number;
  max?: number;
  optional?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        type="number"
        name={name}
        defaultValue={defaultValue}
        min={min}
        max={max}
        required={!optional}
        className="rounded-md border px-3 py-2"
      />
    </label>
  );
}
