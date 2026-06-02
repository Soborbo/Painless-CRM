'use client';

import {
  type AffiliateActionState,
  addAffiliateCode,
  toggleAffiliateCode,
} from '@/lib/actions/affiliates';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const INITIAL: AffiliateActionState = { status: 'idle' };

export type CodeRow = { id: string; code: string; active: boolean | null };

export function AffiliateCodes({
  affiliateId,
  codes,
}: {
  affiliateId: string;
  codes: CodeRow[];
}) {
  const t = useTranslations('affiliates');
  const [addState, addAction, addPending] = useActionState(addAffiliateCode, INITIAL);

  return (
    <div className="flex flex-col gap-4">
      {codes.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('codes.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {codes.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span className="font-mono font-medium">{c.code}</span>
              <CodeToggle affiliateId={affiliateId} code={c} />
            </li>
          ))}
        </ul>
      )}

      <form action={addAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="affiliate_id" value={affiliateId} />
        <label className="flex flex-col gap-1 text-sm">
          {t('codes.newLabel')}
          <input
            name="code"
            required
            placeholder="RELISHHQ"
            className="rounded-md border px-3 py-2 font-mono uppercase outline-none focus:ring-2"
          />
        </label>
        <button
          type="submit"
          disabled={addPending}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
        >
          {t('codes.add')}
        </button>
      </form>
      {addState.status === 'error' ? (
        <p className="text-xs text-[var(--color-danger)]">{addState.message}</p>
      ) : null}
    </div>
  );
}

function CodeToggle({ affiliateId, code }: { affiliateId: string; code: CodeRow }) {
  const t = useTranslations('affiliates');
  const [, action, pending] = useActionState(toggleAffiliateCode, INITIAL);
  const nextActive = !(code.active ?? false);

  return (
    <form action={action}>
      <input type="hidden" name="code_id" value={code.id} />
      <input type="hidden" name="affiliate_id" value={affiliateId} />
      <input type="hidden" name="active" value={String(nextActive)} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border px-2.5 py-1 text-xs hover:bg-[var(--color-muted)] disabled:opacity-50"
      >
        {code.active ? t('codes.disable') : t('codes.enable')}
      </button>
    </form>
  );
}
