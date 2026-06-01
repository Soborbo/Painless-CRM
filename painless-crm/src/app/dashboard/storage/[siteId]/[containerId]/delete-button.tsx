'use client';

import type { StorageActionState } from '@/lib/actions/storage';
import { softDeleteStorageContainer } from '@/lib/actions/storage-container';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const INITIAL: StorageActionState = { status: 'idle' };

export function DeleteContainerButton({
  id,
  siteId,
  version,
}: {
  id: string;
  siteId: string;
  version: number;
}) {
  const t = useTranslations('storage');
  const [state, action, pending] = useActionState(softDeleteStorageContainer, INITIAL);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(t('confirmDeleteContainer'))) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="version" value={version} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[var(--color-danger)] px-3 py-1.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
      >
        {t('delete')}
      </button>
      {state.status === 'error' ? (
        <p className="mt-2 text-xs text-[var(--color-danger)]">{state.message}</p>
      ) : null}
    </form>
  );
}
