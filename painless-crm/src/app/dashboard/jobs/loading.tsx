// Instant skeleton for the jobs card grid while the server renders.
export default function JobsLoading() {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8" aria-busy>
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-[var(--color-muted)]" />
        <div className="h-9 w-72 animate-pulse rounded-lg bg-[var(--color-muted)]/60" />
      </div>
      <div className="h-14 w-full animate-pulse rounded-xl bg-[var(--color-muted)]/60" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className="flex h-64 flex-col gap-3 rounded-xl border bg-[var(--color-background)] p-4"
          >
            <div className="h-5 w-2/3 animate-pulse rounded bg-[var(--color-muted)]" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-muted)]/70" />
            <div className="h-12 w-full animate-pulse rounded-md bg-[var(--color-muted)]/50" />
            <div className="h-12 w-full animate-pulse rounded-md bg-[var(--color-muted)]/50" />
            <div className="mt-auto h-8 w-full animate-pulse rounded-md bg-[var(--color-muted)]/40" />
          </div>
        ))}
      </div>
    </main>
  );
}
