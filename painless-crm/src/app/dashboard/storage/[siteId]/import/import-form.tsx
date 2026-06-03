'use client';

import { INITIAL_IMPORT_STATE, type ImportState, importContainers } from '@/lib/actions/storage-import';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const HEADER_HINT = 'container_code,size_cubic_ft,monthly_rate_pounds,status,notes';

export function ContainerImportForm({ siteId }: { siteId: string }) {
  const t = useTranslations('storageImport');
  const [state, action, pending] = useActionState<ImportState, FormData>(
    importContainers,
    INITIAL_IMPORT_STATE,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="site_id" value={siteId} />

      <p className="rounded-md border bg-[var(--color-muted)]/30 p-3 text-xs">
        {t('columns')}: <code className="font-mono">{HEADER_HINT}</code>
        <br />
        {t('columnsHint')}
      </p>

      <textarea
        name="csv"
        rows={10}
        required
        placeholder={`${HEADER_HINT}\nA-101,160,95,available,Ground floor`}
        className="rounded-md border px-3 py-2 font-mono text-xs"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          name="mode"
          value="preview"
          disabled={pending}
          className="rounded-md border px-4 py-2 text-sm hover:bg-[var(--color-muted)] disabled:opacity-50"
        >
          {pending ? t('working') : t('preview')}
        </button>
        {state.status === 'preview' && state.valid > 0 ? (
          <button
            type="submit"
            name="mode"
            value="commit"
            disabled={pending}
            className="rounded-md border bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
          >
            {t('import', { count: state.valid })}
          </button>
        ) : null}
      </div>

      {state.status === 'error' ? <p className="text-sm text-red-600">{state.message}</p> : null}

      {state.status === 'preview' ? (
        <div className="rounded-md border p-3 text-sm">
          <p className="font-medium">{t('willImport', { count: state.valid })}</p>
          {state.duplicates.length > 0 ? (
            <p className="mt-1 text-xs text-amber-700">
              {t('skipDuplicates', { count: state.duplicates.length })}: {state.duplicates.join(', ')}
            </p>
          ) : null}
          {state.errors.length > 0 ? (
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-red-600">
              {state.errors.map((e) => (
                <li key={e.line}>{t('rowError', { line: e.line, message: e.message })}</li>
              ))}
            </ul>
          ) : null}
          {state.valid === 0 ? <p className="mt-1 text-xs">{t('nothingValid')}</p> : null}
        </div>
      ) : null}

      {state.status === 'done' ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {t('done', { inserted: state.inserted, skipped: state.skipped })}
        </p>
      ) : null}
    </form>
  );
}
