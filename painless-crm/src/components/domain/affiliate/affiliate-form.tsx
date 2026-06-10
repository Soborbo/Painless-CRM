'use client';

import {
  type AffiliateActionState,
  createAffiliate,
  updateAffiliate,
} from '@/lib/actions/affiliates';
import { AFFILIATE_TYPES, COMMISSION_TYPES } from '@/lib/schemas/affiliate';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState } from 'react';

const INITIAL: AffiliateActionState = { status: 'idle' };

export type AffiliateFormDefaults = {
  name: string;
  type: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  commission_type: string;
  commission_value: string;
  active: boolean;
};

const EMPTY: AffiliateFormDefaults = {
  name: '',
  type: 'B2B_partner',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  commission_type: '',
  commission_value: '',
  active: true,
};

export function AffiliateForm({
  mode,
  id,
  version,
  defaults = EMPTY,
}: {
  mode: 'new' | 'edit';
  id?: string;
  version?: number;
  defaults?: AffiliateFormDefaults;
}) {
  const t = useTranslations('affiliates');
  const tc = useTranslations('common');
  const action = mode === 'new' ? createAffiliate : updateAffiliate;
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {version !== undefined ? <input type="hidden" name="version" value={version} /> : null}

      <label className="flex flex-col gap-1 text-sm">
        <span>
          {t('fields.name')}
          <span className="text-[var(--color-danger)]"> *</span>
        </span>
        <input
          name="name"
          required
          defaultValue={defaults.name}
          className="rounded-md border px-3 py-2 outline-none focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t('fields.type')}
        <select
          name="type"
          defaultValue={defaults.type}
          className="rounded-md border px-3 py-2 outline-none focus:ring-2"
        >
          {AFFILIATE_TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`types.${ty}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('fields.contactName')}
          name="contact_name"
          defaultValue={defaults.contact_name}
        />
        <Field
          label={t('fields.contactEmail')}
          name="contact_email"
          type="email"
          defaultValue={defaults.contact_email}
        />
        <Field
          label={t('fields.contactPhone')}
          name="contact_phone"
          defaultValue={defaults.contact_phone}
        />
      </div>

      <fieldset className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">{t('commission.heading')}</legend>
        <label className="flex flex-col gap-1 text-sm">
          {t('commission.type')}
          <select
            name="commission_type"
            defaultValue={defaults.commission_type}
            className="rounded-md border px-3 py-2 outline-none focus:ring-2"
          >
            <option value="">{t('commission.none')}</option>
            {COMMISSION_TYPES.map((ct) => (
              <option key={ct} value={ct}>
                {t(`commission.${ct}`)}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={t('commission.value')}
          name="commission_value"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults.commission_value}
        />
        <p className="text-xs text-[var(--color-muted-foreground)] sm:col-span-2">
          {t('commission.help')}
        </p>
      </fieldset>

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
          href={id ? `/dashboard/affiliates/${id}` : '/dashboard/affiliates'}
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
  defaultValue,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  min?: number;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        min={min}
        step={step}
        className="rounded-md border px-3 py-2 outline-none focus:ring-2"
      />
    </label>
  );
}
