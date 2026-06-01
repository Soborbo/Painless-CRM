'use client';

import type { StorageActionState } from '@/lib/actions/storage';
import { createRental } from '@/lib/actions/storage-rental';
import type { CustomerOption } from '@/lib/queries/customers';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState } from 'react';

const INITIAL: StorageActionState = { status: 'idle' };

export function RentalForm({
  siteId,
  containerId,
  defaultRatePounds,
  customers,
  defaultStartDate,
}: {
  siteId: string;
  containerId: string;
  defaultRatePounds: string;
  customers: CustomerOption[];
  defaultStartDate: string;
}) {
  const t = useTranslations('storage');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState(createRental, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="container_id" value={containerId} />

      <label className="flex flex-col gap-1 text-sm">
        <span>
          {t('fields.customer')}
          <span className="text-[var(--color-danger)]"> *</span>
        </span>
        <select
          name="customer_id"
          required
          defaultValue=""
          className="rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2"
        >
          <option value="" disabled>
            {t('selectCustomer')}
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>
            {t('fields.startDate')}
            <span className="text-[var(--color-danger)]"> *</span>
          </span>
          <input
            type="date"
            name="start_date"
            required
            defaultValue={defaultStartDate}
            className="rounded-md border px-3 py-2 outline-none focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            {t('fields.monthlyRatePounds')}
            <span className="text-[var(--color-danger)]"> *</span>
          </span>
          <input
            type="number"
            name="monthly_rate_pounds"
            min={0}
            step="0.01"
            required
            defaultValue={defaultRatePounds}
            className="rounded-md border px-3 py-2 outline-none focus:ring-2"
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">{t('rentalMode')}</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" value="reserve" defaultChecked />
          {t('modeReserve')}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" value="activate" />
          {t('modeActivate')}
        </label>
      </fieldset>

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
          {pending ? tc('loading') : t('openRental')}
        </button>
        <Link
          href={`/dashboard/storage/${siteId}/${containerId}`}
          className="rounded-md border px-4 py-2 text-sm hover:bg-[var(--color-muted)]"
        >
          {tc('cancel')}
        </Link>
      </div>
    </form>
  );
}
