'use client';

import type { StorageActionState } from '@/lib/actions/storage';
import { createStorageContainer, updateStorageContainer } from '@/lib/actions/storage-container';
import { CONTAINER_STATUSES } from '@/lib/storage/occupancy';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState } from 'react';

const INITIAL: StorageActionState = { status: 'idle' };

export type ContainerFormDefaults = {
  container_code: string;
  size_cubic_ft: string;
  monthly_rate_pounds: string;
  status: string;
  notes: string;
};

const EMPTY: ContainerFormDefaults = {
  container_code: '',
  size_cubic_ft: '',
  monthly_rate_pounds: '',
  status: 'available',
  notes: '',
};

export function ContainerForm({
  mode,
  siteId,
  id,
  version,
  defaults = EMPTY,
}: {
  mode: 'new' | 'edit';
  siteId: string;
  id?: string;
  version?: number;
  defaults?: ContainerFormDefaults;
}) {
  const t = useTranslations('storage');
  const tc = useTranslations('common');
  const action = mode === 'new' ? createStorageContainer : updateStorageContainer;
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="site_id" value={siteId} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {version !== undefined ? <input type="hidden" name="version" value={version} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('fields.containerCode')}
          name="container_code"
          required
          defaultValue={defaults.container_code}
        />
        <label className="flex flex-col gap-1 text-sm">
          {t('fields.status')}
          <select
            name="status"
            defaultValue={defaults.status}
            className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
          >
            {CONTAINER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={t('fields.sizeCubicFt')}
          name="size_cubic_ft"
          type="number"
          min={0}
          step="any"
          defaultValue={defaults.size_cubic_ft}
        />
        <Field
          label={t('fields.monthlyRatePounds')}
          name="monthly_rate_pounds"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={defaults.monthly_rate_pounds}
        />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        {t('fields.notes')}
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaults.notes}
          className="rounded-md border px-3 py-2 outline-none focus:ring-2"
        />
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
          {pending ? tc('loading') : mode === 'new' ? t('addContainer') : tc('save')}
        </button>
        <Link
          href={
            mode === 'edit' && id
              ? `/dashboard/storage/${siteId}/${id}`
              : `/dashboard/storage/${siteId}`
          }
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
