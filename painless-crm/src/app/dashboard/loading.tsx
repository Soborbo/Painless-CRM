// Generic dashboard route-transition fallback: any navigation without a more
// specific loading.tsx shows this instantly instead of a frozen screen.
export default function DashboardLoading() {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8" aria-busy>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--color-muted)]" />
      <div className="h-12 w-full animate-pulse rounded-xl bg-[var(--color-muted)]/60" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-[var(--color-muted)]/60" />
        ))}
      </div>
    </main>
  );
}
