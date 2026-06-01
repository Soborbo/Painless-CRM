import { SignOutButton } from '@/components/auth/sign-out-button';
import { requireRole } from '@/lib/auth/require-role';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ConnectionBar } from './_lib/connection-bar';
import { RegisterServiceWorker } from './_lib/register-sw';

// Mobile-first worker PWA shell. Installable (app/manifest.ts) with a
// conservative service worker; the connection bar is always visible (ADR-011).
// The queued-items counter + "Sync now" land with the IndexedDB queue slice.
export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['loader', 'surveyor', 'manager', 'admin', 'super_admin']);
  const t = await getTranslations('workerApp');

  return (
    <div className="mx-auto min-h-screen max-w-md">
      <RegisterServiceWorker />
      <header className="sticky top-0 z-10 border-b bg-[var(--color-background)]">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/home" className="font-semibold tracking-tight">
            {t('appName')}
          </Link>
          <SignOutButton />
        </div>
        <ConnectionBar />
      </header>
      <div className="px-4 py-5">{children}</div>
    </div>
  );
}
