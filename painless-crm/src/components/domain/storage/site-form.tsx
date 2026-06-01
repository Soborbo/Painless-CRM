'use client';

import { type StorageActionState, createStorageSite } from '@/lib/actions/storage';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState } from 'react';

const INITIAL: StorageActionState = { status: 'idle' };

export function SiteForm() {
  const t = useTranslations('storage');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState(createStorageSite, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Field label={t('fields.name')} name="name" required />

      <fieldset className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">{t('addressLegend')}</legend>
        <Field label={t('fields.line1')} name="line1" required />
        <Field label={t('fields.line2')} name="line2" />
        <Field label={t('fields.city')} name="city" required />
        <Field label={t('fields.postcode')} name="postcode" required />
      </fieldset>

      <Field label={t('fields.totalContainers')} name="total_containers" type="number" min={0} />

      <label className="flex flex-col gap-1 text-sm">
        {t('fields.notes')}
        <textarea
          name="notes"
          rows={3}
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
          {pending ? tc('loading') : t('createSite')}
        </button>
        <Link
          href="/dashboard/storage"
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
  min,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: number;
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
        min={min}
        className="rounded-md border px-3 py-2 outline-none focus:ring-2"
      />
    </label>
  );
}
