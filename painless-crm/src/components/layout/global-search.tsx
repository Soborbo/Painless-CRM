'use client';

import { globalSearch } from '@/lib/actions/global-search';
import type { GlobalSearchResults } from '@/lib/queries/global-search';
import { buildFlatHits, moveHighlight } from '@/lib/search/keyboard';
import { RECENT_SEARCHES_KEY, addRecentSearch, parseRecentSearches } from '@/lib/search/recent';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { RecentSearches, SearchResults } from './global-search-results';

const DEBOUNCE_MS = 180;

const EMPTY: GlobalSearchResults = { customers: [], jobs: [], quotes: [], query: '' };

export function GlobalSearch() {
  const t = useTranslations('search');
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Cmd+K (Mac) / Ctrl+K (Windows) focuses the search from anywhere.
  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onShortcut);
    return () => document.removeEventListener('keydown', onShortcut);
  }, []);

  const flatHits = useMemo(() => buildFlatHits(results), [results]);
  const highlightedKey = highlightedIndex >= 0 ? (flatHits[highlightedIndex]?.key ?? null) : null;

  // A fresh result set invalidates the previous highlight position.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on each new result set
  useEffect(() => setHighlightedIndex(-1), [results]);

  // Keep the highlighted row scrolled into view as arrow nav walks the list.
  useEffect(() => {
    if (!highlightedKey) return;
    containerRef.current
      ?.querySelector(`[data-hit-key="${highlightedKey}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlightedKey]);

  const hasQuery = q.trim().length >= 2;
  // With a live query we show results; with the box focused but empty we
  // surface recent searches (if any) so a click re-runs them.
  const showResults = open && hasQuery;
  const showRecent = open && !hasQuery && recent.length > 0;

  function onSelectHit() {
    rememberSearch(results.query || q);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!showResults) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((i) => moveHighlight(i, flatHits.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((i) => moveHighlight(i, flatHits.length, -1));
    } else if (event.key === 'Enter') {
      const hit = flatHits[highlightedIndex];
      if (!hit) return;
      event.preventDefault();
      onSelectHit();
      router.push(hit.href);
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={t('placeholder')}
        aria-label={t('label')}
        className="w-full rounded-md border bg-white px-3 py-1.5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-muted-foreground)]">
        {t('shortcutHint')}
      </kbd>
      {showRecent ? (
        <RecentSearches
          recent={recent}
          onPick={(term) => {
            setQ(term);
            setOpen(true);
          }}
          onClear={clearRecent}
        />
      ) : null}
      {showResults ? (
        <SearchResults
          results={results}
          pending={pending}
          highlightedKey={highlightedKey}
          onSelectHit={onSelectHit}
        />
      ) : null}
    </div>
  );
}
