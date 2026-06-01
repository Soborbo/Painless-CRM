'use client';

import type { StorageActionState } from '@/lib/actions/storage';
import { activateRental, terminateRental } from '@/lib/actions/storage-rental';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

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
