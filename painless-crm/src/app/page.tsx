import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Painless CRM</h1>
      <p className="text-muted-foreground">
        Internal operations platform for Painless Removals (Bristol).
      </p>
      <Link
        href="/login"
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
      >
        Sign in
      </Link>
    </main>
  );
}
