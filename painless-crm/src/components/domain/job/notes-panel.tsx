import { type NoteCategory, groupNotesByCategory } from '@/lib/notes/group';
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

type NotesT = Awaited<ReturnType<typeof getTranslations<'notes'>>>;

const SECTIONS: { key: NoteCategory; titleKey: 'sectionAdmin' | 'sectionStaff' | 'sectionCustomerVisible' }[] = [
  { key: 'admin', titleKey: 'sectionAdmin' },
  { key: 'staff', titleKey: 'sectionStaff' },
  { key: 'customer_visible', titleKey: 'sectionCustomerVisible' },
];

export async function NotesPanel({ jobId, rows, currentUserId }: Props) {
  const t = await getTranslations('notes');
  const grouped = groupNotesByCategory(rows);

  return (
    <div className="rounded-md border p-4">
      <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t('panelTitle')}
      </h3>
      <div className="mt-3 flex flex-col gap-5 text-sm">
        <AddNoteForm jobId={jobId} />

        {SECTIONS.map((section) => (
          <Timeline
            key={section.key}
            title={t(section.titleKey)}
            rows={grouped[section.key]}
            jobId={jobId}
            currentUserId={currentUserId}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function Timeline({
  title,
  rows,
  jobId,
  currentUserId,
  t,
}: {
  title: string;
  rows: NoteRow[];
  jobId: string;
  currentUserId: string;
  t: NotesT;
}) {
  return (
    <section>
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {title} <span className="font-normal">({rows.length})</span>
      </h4>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{t('empty')}</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-2">
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
    </section>
  );
}
