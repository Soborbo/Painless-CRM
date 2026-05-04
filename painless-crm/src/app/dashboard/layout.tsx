import { RequireRole } from '@/components/auth/require-role';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { requireUser } from '@/lib/auth/require-role';
import { UserProvider } from '@/lib/auth/user-context';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();
  const t = await getTranslations('nav');
  const tu = await getTranslations('users');

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
              <RequireRole allowed={['admin', 'super_admin']}>
                <Link href="/dashboard/settings/users" className="hover:underline">
                  {tu('navLabel')}
                </Link>
              </RequireRole>
            </nav>
            <span className="ml-auto text-[var(--color-muted-foreground)]">
              {profile.full_name} · {profile.role}
            </span>
            <SignOutButton />
          </div>
        </header>
        {children}
      </div>
    </UserProvider>
  );
}
