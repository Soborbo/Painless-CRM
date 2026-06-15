// Instant skeleton for the job detail page while the server renders.
export default function JobDetailLoading() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10" aria-busy>
      <div className="h-4 w-40 animate-pulse rounded bg-[var(--color-muted)]/70" />
      <div className="flex items-center justify-between">
        <div className="h-9 w-44 animate-pulse rounded-lg bg-[var(--color-muted)]" />
        <div className="h-9 w-80 animate-pulse rounded-lg bg-[var(--color-muted)]/60" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-md border bg-[var(--color-muted)]/40" />
          ))}
        </div>
        <div className="flex flex-col gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-md border bg-[var(--color-muted)]/40" />
          ))}
        </div>
      </div>
    </main>
  );
}
