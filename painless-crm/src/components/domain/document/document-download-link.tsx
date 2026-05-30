'use client';

import { getDocumentDownloadUrl } from '@/lib/actions/documents';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

// Fetches a short-lived signed URL on click, then opens it. Keeping the URL out
// of the server-rendered HTML means a stale page never leaks a working link.
export function DocumentDownloadLink({
  documentId,
  fileName,
}: {
  documentId: string;
  fileName: string;
}) {
  const t = useTranslations('documents');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    setBusy(true);
    setError(false);
    const result = await getDocumentDownloadUrl(documentId);
    setBusy(false);
    if (result.ok) {
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } else {
      setError(true);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="text-xs font-medium text-[var(--color-primary)] hover:underline disabled:opacity-50"
    >
      {busy ? t('preparing') : error ? t('downloadRetry') : fileName}
    </button>
  );
}
