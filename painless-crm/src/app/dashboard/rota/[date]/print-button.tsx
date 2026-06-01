'use client';

import { useTranslations } from 'next-intl';

export function PrintButton() {
  const t = useTranslations('rota');
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)] print:hidden"
    >
      {t('print')}
    </button>
  );
}
