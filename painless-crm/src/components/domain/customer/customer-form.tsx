'use client';

import { type CustomerActionState, createCustomer, updateCustomer } from '@/lib/actions/customers';
import { ACQUISITION_SOURCES, type CustomerType } from '@/lib/schemas/customer';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState, useState } from 'react';

const INITIAL: CustomerActionState = { status: 'idle' };

export type CustomerFormDefaults = {
  customer_type: CustomerType;
  first_name: string;
  last_name: string;
  company_name: string;
  vat_number: string;
  payment_terms_days: string;
  primary_email: string;
  primary_phone: string;
  acquisition_source: string;
  acquisition_campaign: string;
  marketing_consent: boolean;
  notes: string;
};

const EMPTY_DEFAULTS: CustomerFormDefaults = {
  customer_type: 'individual',
  first_name: '',
  last_name: '',
  company_name: '',
  vat_number: '',
  payment_terms_days: '',
  primary_email: '',
  primary_phone: '',
  acquisition_source: '',
  acquisition_campaign: '',
  marketing_consent: false,
  notes: '',
};

export function CustomerForm({
  mode,
  id,
  version,
  defaults = EMPTY_DEFAULTS,
}: {
  mode: 'new' | 'edit';
  id?: string;
  version?: number;
  defaults?: CustomerFormDefaults;
}) {
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const action = mode === 'new' ? createCustomer : updateCustomer;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [type, setType] = useState<CustomerType>(defaults.customer_type);
  const [force, setForce] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {version !== undefined ? <input type="hidden" name="version" value={version} /> : null}
      <input type="hidden" name="customer_type" value={type} />
      <input type="hidden" name="force" value={force ? 'true' : 'false'} />

      {mode === 'new' ? (
        <div className="flex gap-2 text-sm" role="tablist">
          <TypeTab active={type === 'individual'} onClick={() => setType('individual')}>
            {t('typeIndividual')}
          </TypeTab>
          <TypeTab active={type === 'business'} onClick={() => setType('business')}>
            {t('typeBusiness')}
          </TypeTab>
        </div>
      ) : null}

      {type === 'individual' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('fields.firstName')}
            name="first_name"
            required
            defaultValue={defaults.first_name}
          />
          <Field
            label={t('fields.lastName')}
            name="last_name"
            required
            defaultValue={defaults.last_name}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('fields.companyName')}
            name="company_name"
            required
            defaultValue={defaults.company_name}
          />
          <Field
            label={t('fields.vatNumber')}
            name="vat_number"
            defaultValue={defaults.vat_number}
          />
          <Field
            label={t('fields.firstName')}
            name="first_name"
            defaultValue={defaults.first_name}
          />
          <Field label={t('fields.lastName')} name="last_name" defaultValue={defaults.last_name} />
          <Field
            label={t('fields.paymentTermsDays')}
            name="payment_terms_days"
            type="number"
            min={0}
            max={120}
            defaultValue={defaults.payment_terms_days}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('fields.email')}
          name="primary_email"
          type="email"
          defaultValue={defaults.primary_email}
        />
        <Field
          label={t('fields.phone')}
          name="primary_phone"
          defaultValue={defaults.primary_phone}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {t('fields.acquisitionSource')}
          <select
            name="acquisition_source"
            defaultValue={defaults.acquisition_source}
            className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
          >
            <option value="">—</option>
            {ACQUISITION_SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`sources.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={t('fields.acquisitionCampaign')}
          name="acquisition_campaign"
          defaultValue={defaults.acquisition_campaign}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="marketing_consent"
          defaultChecked={defaults.marketing_consent}
          className="h-4 w-4"
        />
        {t('fields.marketingConsent')}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t('fields.notes')}
        <textarea
          name="notes"
          rows={4}
          defaultValue={defaults.notes}
          className="rounded-md border px-3 py-2 outline-none focus:ring-2"
        />
      </label>

      {state.status === 'duplicate' ? (
        <div className="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-4 text-sm">
          <p className="font-medium">{t('duplicateWarning')}</p>
          <ul className="mt-2 list-disc pl-5">
            {state.candidates.map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard/customers/${c.id}`} className="underline">
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setForce(true)}
            className="mt-3 rounded-md border px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
          >
            {t('createAnyway')}
          </button>
        </div>
      ) : null}

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
          href={id ? `/dashboard/customers/${id}` : '/dashboard/customers'}
          className="rounded-md border px-4 py-2 text-sm hover:bg-[var(--color-muted)]"
        >
          {tc('cancel')}
        </Link>
      </div>
    </form>
  );
}

function TypeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 ${
        active ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border'
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {required ? <span className="text-[var(--color-danger)]">*</span> : null}
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        min={min}
        max={max}
        className="rounded-md border px-3 py-2 outline-none focus:ring-2"
      />
    </label>
  );
}
