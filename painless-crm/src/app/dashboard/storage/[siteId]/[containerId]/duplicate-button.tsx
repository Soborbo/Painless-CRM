'use client';

import type { StorageActionState } from '@/lib/actions/storage';
import { duplicateStorageContainer } from '@/lib/actions/storage-container';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const INITIAL: StorageActionState = { status: 'idle' };

export function DuplicateContainerButton({ id, siteId }: { id: string; siteId: string }) {
  const t = useTranslations('storage');
  const [state, action, pending] = useActionState(duplicateStorageContainer, INITIAL);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="site_id" value={siteId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)] disabled:opacity-50"
      >
        {t('duplicate')}
      </button>
      {state.status === 'error' ? (
        <p className="mt-2 text-xs text-[var(--color-danger)]">{state.message}</p>
      ) : null}
    </form>
  );
}
