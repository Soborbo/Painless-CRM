import { RequireRole } from '@/components/auth/require-role';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { GlobalSearch } from '@/components/layout/global-search';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { requireUser } from '@/lib/auth/require-role';
import { UserProvider } from '@/lib/auth/user-context';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();
  const t = await getTranslations('nav');
  const tu = await getTranslations('users');
  const tp = await getTranslations('pricing');

  return (
    <UserProvider
      user={{
        id: profile.id,
        company_id: profile.company_id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
      }}
    >
      <div className="min-h-screen">
        <header className="border-b">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3 text-sm">
            <Link href="/dashboard" className="font-semibold tracking-tight">
              Painless CRM
            </Link>
            <nav className="flex gap-3">
              <Link href="/dashboard" className="hover:underline">
                {t('dashboard')}
              </Link>
              <Link href="/dashboard/customers" className="hover:underline">
                {t('customers')}
              </Link>
              <Link href="/dashboard/jobs" className="hover:underline">
                {t('jobs')}
              </Link>
              <Link href="/dashboard/quotes" className="hover:underline">
                {t('quotes')}
              </Link>
              <Link href="/dashboard/sla" className="hover:underline">
                {t('sla')}
              </Link>
              <Link href="/dashboard/callbacks" className="hover:underline">
                {t('callbacks')}
              </Link>
              <RequireRole allowed={['manager', 'admin', 'super_admin']}>
                <Link href="/dashboard/profit" className="hover:underline">
                  {t('profit')}
                </Link>
              </RequireRole>
              <RequireRole allowed={['manager', 'admin', 'super_admin']}>
                <Link href="/dashboard/reports" className="hover:underline">
                  {t('reports')}
                </Link>
              </RequireRole>
              <RequireRole allowed={['manager', 'admin', 'super_admin']}>
                <Link href="/dashboard/capacity" className="hover:underline">
                  {t('capacity')}
                </Link>
              </RequireRole>
              <RequireRole allowed={['manager', 'admin', 'super_admin']}>
                <Link href="/dashboard/vehicles" className="hover:underline">
                  {t('vehicles')}
                </Link>
              </RequireRole>
              <RequireRole allowed={['manager', 'admin', 'super_admin']}>
                <Link href="/dashboard/storage" className="hover:underline">
                  {t('storage')}
                </Link>
              </RequireRole>
              <RequireRole allowed={['manager', 'admin', 'super_admin']}>
                <Link href="/dashboard/workers" className="hover:underline">
                  {t('workers')}
                </Link>
              </RequireRole>
              <RequireRole allowed={['manager', 'admin', 'super_admin']}>
                <Link href="/dashboard/rota" className="hover:underline">
                  {t('rota')}
                </Link>
              </RequireRole>
              <RequireRole allowed={['manager', 'admin', 'super_admin']}>
                <Link href="/dashboard/settings/pricing" className="hover:underline">
                  {tp('navLabel')}
                </Link>
              </RequireRole>
              <RequireRole allowed={['admin', 'super_admin']}>
                <Link href="/dashboard/settings/users" className="hover:underline">
                  {tu('navLabel')}
                </Link>
              </RequireRole>
            </nav>
            <GlobalSearch />
            <span className="text-[var(--color-muted-foreground)]">
              {profile.full_name} · {profile.role}
            </span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        {children}
      </div>
    </UserProvider>
  );
}
