import { SignOutButton } from '@/components/auth/sign-out-button';
import { requireRole } from '@/lib/auth/require-role';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

// Mobile-first worker PWA shell. The offline sync-status bar (ADR-011) and the
// service worker land in a later slice; this is the authenticated frame.
export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['loader', 'surveyor', 'manager', 'admin', 'super_admin']);
  const t = await getTranslations('workerApp');

  return (
    <div className="mx-auto min-h-screen max-w-md">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-[var(--color-background)] px-4 py-3">
        <Link href="/home" className="font-semibold tracking-tight">
          {t('appName')}
        </Link>
        <SignOutButton />
      </header>
      <div className="px-4 py-5">{children}</div>
    </div>
  );
}
