'use client';

import type { GlobalSearchResults } from '@/lib/queries/global-search';
import { customerDisplayName, formatPence } from '@/lib/utils/format';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

// Phase 06b §3 — presentational results panel for the global search popover.
// Pure rendering: the parent owns query/keyboard state and passes the
// highlighted hit key down so the matching row lights up under arrow nav.
export function SearchResults({
  results,
  pending,
  highlightedKey,
  onSelectHit,
}: {
  results: GlobalSearchResults;
  pending: boolean;
  highlightedKey: string | null;
  onSelectHit: () => void;
}) {
  const t = useTranslations('search');
  const totalHits = results.customers.length + results.jobs.length + results.quotes.length;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-md border bg-white shadow-lg">
      {pending && totalHits === 0 ? (
        <p className="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">{t('searching')}</p>
      ) : null}
      {!pending && totalHits === 0 ? (
        <p className="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">{t('noResults')}</p>
      ) : null}
      {results.customers.length > 0 ? (
        <Group label={t('customers')}>
          {results.customers.map((c) => (
            <Row
              key={c.id}
              hitKey={`customer:${c.id}`}
              highlightedKey={highlightedKey}
              href={`/dashboard/customers/${c.id}`}
              title={customerDisplayName(c)}
              subtitle={c.primary_email ?? c.primary_phone ?? t('groupLabel.customer')}
              onSelect={onSelectHit}
            />
          ))}
        </Group>
      ) : null}
      {results.jobs.length > 0 ? (
        <Group label={t('jobs')}>
          {results.jobs.map((j) => (
            <Row
              key={j.id}
              hitKey={`job:${j.id}`}
              highlightedKey={highlightedKey}
              href={`/dashboard/jobs/${j.id}`}
              title={j.job_number}
              subtitle={`${j.stage}${
                j.customer
                  ? ` · ${customerDisplayName({ customer_type: 'individual', primary_email: null, ...j.customer })}`
                  : ''
              }`}
              mono
              onSelect={onSelectHit}
            />
          ))}
        </Group>
      ) : null}
      {results.quotes.length > 0 ? (
        <Group label={t('quotes')}>
          {results.quotes.map((q) => (
            <Row
              key={q.id}
              hitKey={`quote:${q.id}`}
              highlightedKey={highlightedKey}
              href={`/dashboard/jobs/${q.job_id}/quote/${q.id}`}
              title={q.job?.job_number ?? '—'}
              subtitle={`${q.status ?? 'draft'} · ${formatPence(q.total_pence)}`}
              mono
              onSelect={onSelectHit}
            />
          ))}
        </Group>
      ) : null}
    </div>
  );
}

// Phase 06b §3 — recent-searches panel shown when the box is focused but
// empty. Clicking a term re-runs it; the parent owns the localStorage list.
export function RecentSearches({
  recent,
  onPick,
  onClear,
}: {
  recent: string[];
  onPick: (term: string) => void;
  onClear: () => void;
}) {
  const t = useTranslations('search');
  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-md border bg-white shadow-lg">
      <div className="flex items-center justify-between bg-[var(--color-muted)] px-3 py-1">
        <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('recent')}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          {t('clearRecent')}
        </button>
      </div>
      <ul className="divide-y">
        {recent.map((term) => (
          <li key={term}>
            <button
              type="button"
              onClick={() => onPick(term)}
              className="flex w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-muted)]"
            >
              {term}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b last:border-b-0">
      <p className="bg-[var(--color-muted)] px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <ul className="divide-y">{children}</ul>
    </div>
  );
}

function Row({
  hitKey,
  highlightedKey,
  href,
  title,
  subtitle,
  mono,
  onSelect,
}: {
  hitKey: string;
  highlightedKey: string | null;
  href: string;
  title: string;
  subtitle: string;
  mono?: boolean;
  onSelect: () => void;
}) {
  const highlighted = hitKey === highlightedKey;
  return (
    <li>
      <Link
        href={href}
        onClick={onSelect}
        data-hit-key={hitKey}
        className={`flex items-baseline justify-between gap-3 px-3 py-2 text-sm hover:bg-[var(--color-muted)] ${
          highlighted ? 'bg-[var(--color-muted)]' : ''
        }`}
      >
        <span className={mono ? 'font-mono' : ''}>{title}</span>
        <span className="truncate text-xs text-[var(--color-muted-foreground)]">{subtitle}</span>
      </Link>
    </li>
  );
}
