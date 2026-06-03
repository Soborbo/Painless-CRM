import { SignOutButton } from '@/components/auth/sign-out-button';
import { GlobalSearch } from '@/components/layout/global-search';
import { NotificationBell } from '@/components/layout/notification-bell';
import { type NavGroup, SidebarNav } from '@/components/layout/sidebar-nav';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { requireUser } from '@/lib/auth/require-role';
import { UserProvider } from '@/lib/auth/user-context';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';

const MANAGER = ['manager', 'admin', 'super_admin'];
const BILLING = ['accounts', 'manager', 'admin', 'super_admin'];
const ADMIN = ['admin', 'super_admin'];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();
  const t = await getTranslations('nav');
  const tu = await getTranslations('users');
  const tp = await getTranslations('pricing');
  const te = await getTranslations('exports');
  const tc = await getTranslations('companySettings');

  // Server-side role filtering — only links this role can open are rendered.
  const can = (roles?: string[]) => !roles || roles.includes(profile.role);
  const link = (href: string, label: string, roles?: string[]) =>
    can(roles) ? [{ href, label }] : [];

  const rawGroups: NavGroup[] = [
    { links: [...link('/dashboard', t('dashboard'))] },
    {
      title: 'Sales',
      links: [
        ...link('/dashboard/customers', t('customers')),
        ...link('/dashboard/jobs', t('jobs')),
        ...link('/dashboard/quotes', t('quotes')),
        ...link('/dashboard/messages', t('messages'), [
          'sales',
          'accounts',
          'manager',
          'admin',
          'super_admin',
        ]),
        ...link('/dashboard/sla', t('sla')),
        ...link('/dashboard/callbacks', t('callbacks')),
      ],
    },
    {
      title: 'Operations',
      links: [
        ...link('/dashboard/dispatch', t('dispatch'), MANAGER),
        ...link('/dashboard/calendar', t('calendar'), MANAGER),
        ...link('/dashboard/rota', t('rota'), MANAGER),
        ...link('/dashboard/vehicles', t('vehicles'), MANAGER),
        ...link('/dashboard/storage', t('storage'), MANAGER),
        ...link('/dashboard/workers', t('workers'), MANAGER),
        ...link('/dashboard/capacity', t('capacity'), MANAGER),
      ],
    },
    {
      title: 'Finance',
      links: [
        ...link('/dashboard/invoices', t('invoices'), BILLING),
        ...link('/dashboard/profit', t('profit'), MANAGER),
      ],
    },
    {
      title: 'Customer care',
      links: [
        ...link('/dashboard/complaints', t('complaints'), MANAGER),
        ...link('/dashboard/damages', t('damages'), MANAGER),
        ...link('/dashboard/reports', t('reports'), MANAGER),
        ...link('/dashboard/reports/analytics', t('analytics'), MANAGER),
      ],
    },
    {
      title: 'Growth',
      links: [
        ...link('/dashboard/affiliates', t('affiliates'), MANAGER),
        ...link('/dashboard/affiliates/payouts', t('payouts'), MANAGER),
      ],
    },
    {
      title: 'Settings',
      links: [
        ...link('/dashboard/settings/company', tc('navLabel'), MANAGER),
        ...link('/dashboard/settings/pricing', tp('navLabel'), MANAGER),
        ...link('/dashboard/settings/templates', t('templates'), MANAGER),
        ...link('/dashboard/settings/automations', t('automations'), MANAGER),
        ...link('/dashboard/settings/exports', te('navLabel'), ADMIN),
        ...link('/dashboard/settings/users', tu('navLabel'), ADMIN),
      ],
    },
  ];
  const groups = rawGroups.filter((g) => g.links.length > 0);

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
      <div className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col bg-[var(--color-sidebar)] text-[var(--color-sidebar-foreground)]">
          {/* Brand tick: a 2px orange rule across the top edge. */}
          <div className="h-0.5 w-full shrink-0 bg-[var(--color-accent)]" aria-hidden />

          <div className="border-b border-white/10 px-4 pb-4 pt-4">
            <Link
              href="/dashboard"
              className="block rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <Image
                src="/logo.svg"
                alt="Painless Removals"
                width={176}
                height={56}
                priority
                unoptimized
                className="h-9 w-auto"
              />
            </Link>
            <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-sidebar-foreground)]/40">
              Operations Console
            </p>
          </div>

          <SidebarNav groups={groups} />

          <div className="border-t border-white/10 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[var(--color-sidebar-foreground)]/85">
                  {profile.full_name}
                </p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent)]/90">
                  {profile.role}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-4 border-b border-b-[var(--color-border)] px-6 py-3">
            <GlobalSearch />
            <div className="ml-auto">
              <NotificationBell />
            </div>
          </header>
          {children}
        </div>
      </div>
    </UserProvider>
  );
}
