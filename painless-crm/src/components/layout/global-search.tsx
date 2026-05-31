'use client';

import { globalSearch } from '@/lib/actions/global-search';
import type { GlobalSearchResults } from '@/lib/queries/global-search';
import { RECENT_SEARCHES_KEY, addRecentSearch, parseRecentSearches } from '@/lib/search/recent';
import { customerDisplayName, formatPence } from '@/lib/utils/format';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';

const DEBOUNCE_MS = 180;

const EMPTY: GlobalSearchResults = { customers: [], jobs: [], quotes: [], query: '' };

export function GlobalSearch() {
  const t = useTranslations('search');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Load the persisted recent searches once on mount. localStorage can throw
  // (private mode, disabled storage) or hold malformed JSON — swallow both.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
      if (raw) setRecent(parseRecentSearches(JSON.parse(raw)));
    } catch {
      // ignore — recents are a convenience, never load-bearing
    }
  }, []);

  function rememberSearch(term: string) {
    setRecent((prev) => {
      const next = addRecentSearch(prev, term);
      try {
        window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        // ignore write failures
      }
      return next;
    });
  }

  function clearRecent() {
    setRecent([]);
    try {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(EMPTY);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const next = await globalSearch(q);
        setResults(next);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const totalHits = results.customers.length + results.jobs.length + results.quotes.length;
  const hasQuery = q.trim().length >= 2;
  // With a live query we show results; with the box focused but empty we
  // surface recent searches (if any) so a click re-runs them.
  const showResults = open && hasQuery;
  const showRecent = open && !hasQuery && recent.length > 0;

  function onSelectHit() {
    rememberSearch(results.query || q);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t('placeholder')}
        aria-label={t('label')}
        className="w-full rounded-md border bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      />
      {showRecent ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-md border bg-white shadow-lg">
          <div className="flex items-center justify-between bg-[var(--color-muted)] px-3 py-1">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t('recent')}
            </p>
            <button
              type="button"
              onClick={clearRecent}
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
                  onClick={() => {
                    setQ(term);
                    setOpen(true);
                  }}
                  className="flex w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-muted)]"
                >
                  {term}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {showResults ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-md border bg-white shadow-lg">
          {pending && totalHits === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
              {t('searching')}
            </p>
          ) : null}
          {!pending && totalHits === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
              {t('noResults')}
            </p>
          ) : null}
          {results.customers.length > 0 ? (
            <Group label={t('customers')}>
              {results.customers.map((c) => (
                <Row
                  key={c.id}
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
      ) : null}
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
  href,
  title,
  subtitle,
  mono,
  onSelect,
}: {
  href: string;
  title: string;
  subtitle: string;
  mono?: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onSelect}
        className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
      >
        <span className={mono ? 'font-mono' : ''}>{title}</span>
        <span className="truncate text-xs text-[var(--color-muted-foreground)]">{subtitle}</span>
      </Link>
    </li>
  );
}
