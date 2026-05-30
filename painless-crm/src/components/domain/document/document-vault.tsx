import type { UploadParentType } from '@/lib/documents/constants';
import { formatFileSize } from '@/lib/documents/storage-path';
import type { DocumentRow } from '@/lib/queries/documents';
import { formatDateTime } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import { DeleteDocumentButton } from './delete-document-button';
import { DocumentDownloadLink } from './document-download-link';
import { UploadDocumentForm } from './upload-document-form';

interface Props {
  parentType: UploadParentType;
  parentId: string;
  rows: DocumentRow[];
}

export async function DocumentVault({ parentType, parentId, rows }: Props) {
  const t = await getTranslations('documents');

  return (
    <div className="rounded-md border p-4">
      <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t('panelTitle')}
      </h3>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        <UploadDocumentForm parentType={parentType} parentId={parentId} />

        {rows.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
                    {t(`type.${row.document_type}`)}
                  </span>
                  {row.is_customer_visible ? (
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
                      {t('badgeCustomerVisible')}
                    </span>
                  ) : null}
                  <DocumentDownloadLink documentId={row.id} fileName={row.file_name} />
                  <span className="ml-auto">
                    <DeleteDocumentButton
                      documentId={row.id}
                      parentType={parentType}
                      parentId={parentId}
                    />
                  </span>
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {t('meta', {
                    size: formatFileSize(row.file_size_bytes),
                    at: formatDateTime(row.uploaded_at),
                    by: row.uploaded_by_customer
                      ? t('uploadedByCustomer')
                      : (row.uploaded_by?.full_name ?? t('uploadedBySystem')),
                  })}
                </p>
                {row.notes ? <p className="whitespace-pre-wrap text-sm">{row.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
