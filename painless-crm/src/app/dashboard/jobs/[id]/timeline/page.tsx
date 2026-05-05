import { requireUser } from '@/lib/auth/require-role';
import type { TimelineEvent } from '@/lib/jobs/timeline-merge';
import { getJobTimeline } from '@/lib/queries/job-timeline';
import { getJobById } from '@/lib/queries/jobs';
import { formatDateTime, formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export default async function TimelinePage({ params }: Props) {
  const { id } = await params;
  await requireUser();
  const [job, events, t, tj] = await Promise.all([
    getJobById(id),
    getJobTimeline(id),
    getTranslations('timeline'),
    getTranslations('jobs'),
  ]);
  if (!job) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <nav className="text-sm text-[var(--color-muted-foreground)]">
        <Link href={`/dashboard/jobs/${id}`} className="hover:underline">
          {job.job_number}
        </Link>
        <span className="mx-1.5">/</span>
        <span>{t('title')}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      </header>

      {events.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('empty')}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {events.map((event, idx) => (
            <Row key={`${event.kind}-${event.at}-${idx}`} event={event} t={t} tj={tj} />
          ))}
        </ol>
      )}
    </main>
  );
}

function Row({
  event,
  t,
  tj,
}: {
  event: TimelineEvent;
  t: Awaited<ReturnType<typeof getTranslations<'timeline'>>>;
  tj: Awaited<ReturnType<typeof getTranslations<'jobs'>>>;
}) {
  return (
    <li className="grid grid-cols-[140px_1fr] gap-3 border-l-2 border-[var(--color-muted)] pl-3">
      <span className="text-xs text-[var(--color-muted-foreground)]">
        {formatDateTime(event.at)}
      </span>
      <div className="flex flex-col gap-1 text-sm">
        <Header event={event} t={t} tj={tj} />
        <Body event={event} t={t} />
      </div>
    </li>
  );
}

function Header({
  event,
  t,
  tj,
}: {
  event: TimelineEvent;
  t: Awaited<ReturnType<typeof getTranslations<'timeline'>>>;
  tj: Awaited<ReturnType<typeof getTranslations<'jobs'>>>;
}) {
  switch (event.kind) {
    case 'stage':
      return (
        <p className="font-medium">
          {t('stageHeader', {
            from: event.from ? tj(`stages.${event.from}` as never) : t('initial'),
            to: tj(`stages.${event.to}` as never),
          })}
          {event.actor ? (
            <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">
              · {event.actor}
            </span>
          ) : null}
        </p>
      );
    case 'note':
      return (
        <p className="font-medium">
          {event.is_customer_visible ? t('noteCustomerVisible') : t('noteInternal')}
          {event.actor ? (
            <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">
              · {event.actor}
            </span>
          ) : null}
        </p>
      );
    case 'call':
      return (
        <p className="font-medium">
          {t(event.direction === 'inbound' ? 'callInbound' : 'callOutbound')}
          {event.duration_seconds !== null ? (
            <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">
              · {formatDuration(event.duration_seconds)}
            </span>
          ) : null}
          {event.actor ? (
            <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">
              · {event.actor}
            </span>
          ) : null}
        </p>
      );
    case 'quote_created':
      return (
        <p className="font-medium">
          {t('quoteCreated', { total: formatPence(event.total_pence) })}
        </p>
      );
    case 'quote_sent':
      return <p className="font-medium">{t('quoteSent')}</p>;
    case 'quote_accepted':
      return (
        <p className="font-medium">
          {t('quoteAccepted')}
          {event.acceptor_name ? (
            <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">
              · {event.acceptor_name}
            </span>
          ) : null}
        </p>
      );
    case 'quote_opened':
      return <p className="font-medium">{t('quoteOpened', { count: event.open_count })}</p>;
    case 'quote_declined':
      return <p className="font-medium text-red-700">{t('quoteDeclined')}</p>;
  }
}

function Body({
  event,
  t,
}: {
  event: TimelineEvent;
  t: Awaited<ReturnType<typeof getTranslations<'timeline'>>>;
}) {
  if (event.kind === 'stage' && event.reason) {
    return <p className="text-[var(--color-muted-foreground)]">{event.reason}</p>;
  }
  if (event.kind === 'note') {
    return <p className="whitespace-pre-wrap">{event.body}</p>;
  }
  if (event.kind === 'quote_accepted') {
    return <p className="text-[var(--color-muted-foreground)]">{t('quoteAcceptedHelp')}</p>;
  }
  if (event.kind === 'quote_declined' && event.reason) {
    return <p className="text-[var(--color-muted-foreground)]">"{event.reason}"</p>;
  }
  return null;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs ? `${mins}m ${secs}s` : `${mins}m`;
}
