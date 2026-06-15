import Link from 'next/link';

export function Pagination({
  page,
  lastPage,
  q,
  stage,
  assignedTo,
  moveFrom,
  moveTo,
  view,
}: {
  page: number;
  lastPage: number;
  q?: string;
  stage?: string;
  assignedTo?: string;
  moveFrom?: string;
  moveTo?: string;
  view?: 'grid' | 'list';
}) {
  if (lastPage <= 1) return null;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (stage) params.set('stage', stage);
  if (assignedTo) params.set('assigned_to_id', assignedTo);
  if (moveFrom) params.set('move_from', moveFrom);
  if (moveTo) params.set('move_to', moveTo);
  if (view && view !== 'grid') params.set('view', view);
  const link = (n: number) => {
    const p = new URLSearchParams(params);
    p.set('page', String(n));
    return `/dashboard/jobs?${p.toString()}`;
  };

  const btn = 'rounded-lg border px-3 py-1.5 transition-colors hover:bg-[var(--color-muted)]';

  return (
    <nav className="flex items-center justify-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={link(page - 1)} className={btn}>
          ← Prev
        </Link>
      ) : (
        <span className="rounded-lg border px-3 py-1.5 opacity-40">← Prev</span>
      )}
      <span className="text-[var(--color-muted-foreground)]">
        {page} / {lastPage}
      </span>
      {page < lastPage ? (
        <Link href={link(page + 1)} className={btn}>
          Next →
        </Link>
      ) : (
        <span className="rounded-lg border px-3 py-1.5 opacity-40">Next →</span>
      )}
    </nav>
  );
}
