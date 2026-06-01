'use client';

import { type WorkerActionState, createWorker, updateWorker } from '@/lib/actions/workers';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState } from 'react';

const INITIAL: WorkerActionState = { status: 'idle' };

export type WorkerFormDefaults = {
  full_name: string;
  phone: string;
  email: string;
  hourly_rate_pounds: string;
  skills: string;
  active: boolean;
  notes: string;
};

const EMPTY: WorkerFormDefaults = {
  full_name: '',
  phone: '',
  email: '',
  hourly_rate_pounds: '',
  skills: '',
  active: true,
  notes: '',
};

export function WorkerForm({
  mode,
  id,
  version,
  defaults = EMPTY,
}: {
  mode: 'new' | 'edit';
  id?: string;
  version?: number;
  defaults?: WorkerFormDefaults;
}) {
  const t = useTranslations('workers');
  const tc = useTranslations('common');
  const action = mode === 'new' ? createWorker : updateWorker;
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {version !== undefined ? <input type="hidden" name="version" value={version} /> : null}

      <Field
        label={t('fields.fullName')}
        name="full_name"
        required
        defaultValue={defaults.full_name}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('fields.phone')} name="phone" defaultValue={defaults.phone} />
        <Field label={t('fields.email')} name="email" type="email" defaultValue={defaults.email} />
        <Field
          label={t('fields.hourlyRatePounds')}
          name="hourly_rate_pounds"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults.hourly_rate_pounds}
        />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        {t('fields.skills')}
        <textarea
          name="skills"
          rows={2}
          defaultValue={defaults.skills}
          placeholder={t('skillsPlaceholder')}
          className="rounded-md border px-3 py-2 outline-none focus:ring-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t('fields.notes')}
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaults.notes}
          className="rounded-md border px-3 py-2 outline-none focus:ring-2"
        />
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
          href={id ? `/dashboard/workers/${id}` : '/dashboard/workers'}
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
