'use client';

import type { StorageActionState } from '@/lib/actions/storage';
import { activateRental, terminateRental, updateRental } from '@/lib/actions/storage-rental';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';

const INITIAL: StorageActionState = { status: 'idle' };

type Props = {
  rentalId: string;
  rentalVersion: number;
  containerId: string;
  containerVersion: number;
  siteId: string;
};

function HiddenFields({ rentalId, rentalVersion, containerId, containerVersion, siteId }: Props) {
  return (
    <>
      <input type="hidden" name="rental_id" value={rentalId} />
      <input type="hidden" name="rental_version" value={rentalVersion} />
      <input type="hidden" name="container_id" value={containerId} />
      <input type="hidden" name="container_version" value={containerVersion} />
      <input type="hidden" name="site_id" value={siteId} />
    </>
  );
}

export function ActivateRentalButton(props: Props) {
  const t = useTranslations('storage');
  const [state, action, pending] = useActionState(activateRental, INITIAL);
  return (
    <form action={action}>
      <HiddenFields {...props} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)] disabled:opacity-50"
      >
        {t('activateRental')}
      </button>
      {state.status === 'error' ? (
        <p className="mt-1 text-xs text-[var(--color-danger)]">{state.message}</p>
      ) : null}
    </form>
  );
}

export function TerminateRentalButton(props: Props) {
  const t = useTranslations('storage');
  const [state, action, pending] = useActionState(terminateRental, INITIAL);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(t('confirmTerminate'))) e.preventDefault();
      }}
    >
      <HiddenFields {...props} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[var(--color-danger)] px-3 py-1.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
      >
        {t('terminateRental')}
      </button>
      {state.status === 'error' ? (
        <p className="mt-1 text-xs text-[var(--color-danger)]">{state.message}</p>
      ) : null}
    </form>
  );
}

export function EditRentalButton({
  rentalId,
  rentalVersion,
  containerId,
  siteId,
  currentRatePence,
  currentNotes,
}: {
  rentalId: string;
  rentalVersion: number;
  containerId: string;
  siteId: string;
  currentRatePence: number;
  currentNotes: string | null;
}) {
  const t = useTranslations('storage');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateRental, INITIAL);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
      >
        {t('editRate')}
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="rental_id" value={rentalId} />
      <input type="hidden" name="version" value={rentalVersion} />
      <input type="hidden" name="container_id" value={containerId} />
      <input type="hidden" name="site_id" value={siteId} />
      <input
        name="monthly_rate_pounds"
        type="number"
        step="0.01"
        min="0"
        defaultValue={(currentRatePence / 100).toFixed(2)}
        aria-label={t('fields.monthlyRatePounds')}
        className="w-28 rounded-md border px-2 py-1 text-sm"
      />
      <input
        name="notes"
        defaultValue={currentNotes ?? ''}
        placeholder={t('fields.notes')}
        maxLength={2000}
        className="w-40 rounded-md border px-2 py-1 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--color-primary)] px-3 py-1 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
        >
          {pending ? tc('loading') : tc('save')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border px-3 py-1 text-sm hover:bg-[var(--color-muted)]"
        >
          {tc('cancel')}
        </button>
      </div>
      {state.status === 'error' ? (
        <p className="text-xs text-[var(--color-danger)]">{state.message}</p>
      ) : null}
    </form>
  );
}
