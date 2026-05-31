'use client';

import {
  type DocumentActionState,
  INITIAL_DOCUMENT_ACTION_STATE,
  uploadDocument,
} from '@/lib/actions/documents';
import { DOCUMENT_TYPES, type UploadParentType } from '@/lib/documents/constants';
import { useTranslations } from 'next-intl';
import { useActionState, useRef, useState } from 'react';

export function UploadDocumentForm({
  parentType,
  parentId,
}: {
  parentType: UploadParentType;
  parentId: string;
}) {
  const t = useTranslations('documents');
  const tc = useTranslations('common');
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [state, formAction, pending] = useActionState<DocumentActionState, FormData>(
    async (prev, fd) => {
      const next = await uploadDocument(prev, fd);
      if (next.status === 'ok') {
        formRef.current?.reset();
        setFileName(null);
      }
      return next;
    },
    INITIAL_DOCUMENT_ACTION_STATE,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="parent_type" value={parentType} />
      <input type="hidden" name="parent_id" value={parentId} />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length && fileInputRef.current) {
            fileInputRef.current.files = e.dataTransfer.files;
            setFileName(e.dataTransfer.files[0]?.name ?? null);
          }
        }}
        className={`rounded-md border border-dashed px-3 py-4 text-center text-xs ${
          dragging ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : ''
        }`}
      >
        <label className="cursor-pointer text-[var(--color-primary)] hover:underline">
          {fileName ?? t('dropHint')}
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            required
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          name="document_type"
          defaultValue="other"
          className="rounded-md border px-2 py-1.5 text-xs"
        >
          {DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`type.${type}`)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="is_customer_visible" />
          <span>{t('visibilityToggle')}</span>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="ml-auto rounded-md border bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
        >
          {pending ? tc('loading') : t('upload')}
        </button>
      </div>
      <input
        type="text"
        name="notes"
        maxLength={2000}
        placeholder={t('notesPlaceholder')}
        className="rounded-md border px-3 py-1.5 text-xs"
      />
      {state.status === 'error' ? <p className="text-xs text-red-600">{state.message}</p> : null}
    </form>
  );
}
