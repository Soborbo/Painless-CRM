import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

/**
 * Server-rendered sortable column header. Renders a link that toggles the
 * `sort`/`dir` query params (resetting `page`) while preserving the other
 * active filters, so sorting runs server-side across the full dataset rather
 * than only the loaded page. Pair with a query that reads sort/dir.
 */
export function SortableHeader({
  label,
  column,
  sort,
  dir,
  params,
  className,
}: {
  label: string;
  /** The sort key this header sets (must match the query's allow-list). */
  column: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  /** Other active query params to preserve in the link (q, type, dates…). */
  params?: Record<string, string | number | null | undefined>;
  className?: string;
}) {
  const active = sort === column;
  const nextDir = active && dir === 'asc' ? 'desc' : 'asc';

  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') sp.set(key, String(value));
  }
  sp.set('sort', column);
  sp.set('dir', nextDir);
  sp.delete('page');

  return (
    <Link
      href={`?${sp.toString()}`}
      className={cn('inline-flex items-center gap-1 hover:text-foreground', className)}
    >
      {label}
      {active ? (
        dir === 'desc' ? (
          <ArrowDown className="size-3.5" />
        ) : (
          <ArrowUp className="size-3.5" />
        )
      ) : (
        <ChevronsUpDown className="size-3.5 opacity-40" />
      )}
    </Link>
  );
}
