'use client';

import {
  INITIAL_DOCUMENT_ACTION_STATE,
  type DocumentActionState,
  softDeleteDocument,
} from '@/lib/actions/documents';
import type { UploadParentType } from '@/lib/documents/constants';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

export function DeleteDocumentButton({
  documentId,
  parentType,
  parentId,
}: {
  documentId: string;
  parentType: UploadParentType;
  parentId: string;
}) {
  const t = useTranslations('documents');
  const [state, formAction, pending] = useActionState<DocumentActionState, FormData>(
    softDeleteDocument,
    INITIAL_DOCUMENT_ACTION_STATE,
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={documentId} />
      <input type="hidden" name="parent_type" value={parentType} />
      <input type="hidden" name="parent_id" value={parentId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-[var(--color-muted-foreground)] hover:text-red-600 disabled:opacity-50"
        aria-label={t('delete')}
      >
        {state.status === 'error' ? t('deleteRetry') : t('delete')}
      </button>
    </form>
  );
}
