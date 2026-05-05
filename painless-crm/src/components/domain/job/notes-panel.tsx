import type { NoteRow } from '@/lib/queries/notes';
import { formatDateTime } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import { AddNoteForm } from './add-note-form';
import { DeleteNoteButton } from './delete-note-button';

interface Props {
  jobId: string;
  rows: NoteRow[];
  currentUserId: string;
}

export async function NotesPanel({ jobId, rows, currentUserId }: Props) {
  const t = await getTranslations('notes');

  return (
    <div className="rounded-md border p-4">
      <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t('panelTitle')}
      </h3>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        <AddNoteForm jobId={jobId} />

        {rows.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <VisibilityBadge isVisible={row.is_customer_visible} t={t} />
                  {row.created_by ? (
                    <span className="text-xs font-medium">{row.created_by.full_name}</span>
                  ) : null}
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {formatDateTime(row.created_at)}
                  </span>
                  {row.created_by?.id === currentUserId ? (
                    <span className="ml-auto">
                      <DeleteNoteButton noteId={row.id} jobId={jobId} />
                    </span>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-sm">{row.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function VisibilityBadge({
  isVisible,
  t,
}: {
  isVisible: boolean;
  t: Awaited<ReturnType<typeof getTranslations<'notes'>>>;
}) {
  if (isVisible) {
    return (
      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
        {t('badgeCustomerVisible')}
      </span>
    );
  }
  return (
    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
      {t('badgeInternal')}
    </span>
  );
}
