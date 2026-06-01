import { SignOutButton } from '@/components/auth/sign-out-button';
import { requireRole } from '@/lib/auth/require-role';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { RegisterServiceWorker } from './_lib/register-sw';
import { SyncProvider } from './_lib/sync-context';
import { SyncStatusBar } from './_lib/sync-status-bar';

// Mobile-first worker PWA shell. Installable (app/manifest.ts) with a
// conservative service worker. The SyncProvider holds the offline-queue state;
// the always-visible SyncStatusBar shows sync state + counter + "Sync now"
// (ADR-011).
export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['loader', 'surveyor', 'manager', 'admin', 'super_admin']);
  const t = await getTranslations('workerApp');

  return (
    <SyncProvider>
      <div className="mx-auto min-h-screen max-w-md">
        <RegisterServiceWorker />
        <header className="sticky top-0 z-10 border-b bg-[var(--color-background)]">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/home" className="font-semibold tracking-tight">
              {t('appName')}
            </Link>
            <SignOutButton />
          </div>
          <SyncStatusBar />
        </header>
        <div className="px-4 py-5">{children}</div>
      </div>
    </SyncProvider>
  );
}
