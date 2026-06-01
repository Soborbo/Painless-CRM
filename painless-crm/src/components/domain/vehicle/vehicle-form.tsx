'use client';

import { type VehicleActionState, createVehicle, updateVehicle } from '@/lib/actions/vehicles';
import { VEHICLE_TYPES } from '@/lib/schemas/vehicle';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState } from 'react';

const INITIAL: VehicleActionState = { status: 'idle' };

export type VehicleFormDefaults = {
  registration: string;
  type: string;
  capacity_cubic_ft: string;
  monthly_cost_pounds: string;
  active: boolean;
  compliance_alerts_enabled: boolean;
  mot_due: string;
  tax_due: string;
  insurance_due: string;
  next_service_due: string;
};

const EMPTY_DEFAULTS: VehicleFormDefaults = {
  registration: '',
  type: 'luton',
  capacity_cubic_ft: '',
  monthly_cost_pounds: '',
  active: true,
  compliance_alerts_enabled: true,
  mot_due: '',
  tax_due: '',
  insurance_due: '',
  next_service_due: '',
};

export function VehicleForm({
  mode,
  id,
  version,
  defaults = EMPTY_DEFAULTS,
}: {
  mode: 'new' | 'edit';
  id?: string;
  version?: number;
  defaults?: VehicleFormDefaults;
}) {
  const t = useTranslations('vehicles');
  const tc = useTranslations('common');
  const action = mode === 'new' ? createVehicle : updateVehicle;
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {version !== undefined ? <input type="hidden" name="version" value={version} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('fields.registration')}
          name="registration"
          required
          defaultValue={defaults.registration}
        />
        <label className="flex flex-col gap-1 text-sm">
          {t('fields.type')}
          <select
            name="type"
            defaultValue={defaults.type}
            className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
          >
            {VEHICLE_TYPES.map((vt) => (
              <option key={vt} value={vt}>
                {t(`types.${vt.replace('.', '_')}`)}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={t('fields.capacityCubicFt')}
          name="capacity_cubic_ft"
          type="number"
          min={0}
          step="any"
          defaultValue={defaults.capacity_cubic_ft}
        />
        <Field
          label={t('fields.monthlyCostPounds')}
          name="monthly_cost_pounds"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults.monthly_cost_pounds}
        />
      </div>

      <fieldset className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">{t('complianceLegend')}</legend>
        <Field
          label={t('fields.motDue')}
          name="mot_due"
          type="date"
          defaultValue={defaults.mot_due}
        />
        <Field
          label={t('fields.taxDue')}
          name="tax_due"
          type="date"
          defaultValue={defaults.tax_due}
        />
        <Field
          label={t('fields.insuranceDue')}
          name="insurance_due"
          type="date"
          defaultValue={defaults.insurance_due}
        />
        <Field
          label={t('fields.nextServiceDue')}
          name="next_service_due"
          type="date"
          defaultValue={defaults.next_service_due}
        />
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="compliance_alerts_enabled"
          defaultChecked={defaults.compliance_alerts_enabled}
          className="h-4 w-4"
        />
        {t('fields.complianceAlertsEnabled')}
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={defaults.active} className="h-4 w-4" />
        {t('fields.active')}
      </label>

      {state.status === 'error' ? (
        <p className="text-sm text-[var(--color-danger)]">{state.message}</p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? tc('loading') : mode === 'new' ? t('create') : tc('save')}
        </button>
        <Link
          href={id ? `/dashboard/vehicles/${id}` : '/dashboard/vehicles'}
          className="rounded-md border px-4 py-2 text-sm hover:bg-[var(--color-muted)]"
        >
          {tc('cancel')}
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  min?: number;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>
        {label}
        {required ? <span className="text-[var(--color-danger)]"> *</span> : null}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        min={min}
        step={step}
        className="rounded-md border px-3 py-2 outline-none focus:ring-2"
      />
    </label>
  );
}
