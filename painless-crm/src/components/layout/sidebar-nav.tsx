'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavLink {
  href: string;
  label: string;
}
export interface NavGroup {
  title?: string;
  links: NavLink[];
}

function isActive(pathname: string, href: string): boolean {
  // /dashboard is the overview — exact match only, so it doesn't light up for
  // every nested route. Everything else matches on prefix.
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href);
}

// Scrollable vertical nav for the brand sidebar. Active route highlighted in the
// brand accent; the list scrolls on its own so a long menu never overflows.
export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      {groups.map((group, i) => (
        <div key={group.title ?? `g${i}`} className="mb-3">
          {group.title ? (
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-sidebar-foreground)]/50">
              {group.title}
            </p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? 'bg-[var(--color-accent)] font-medium text-[var(--color-accent-foreground)]'
                        : 'text-[var(--color-sidebar-foreground)]/85 hover:bg-white/10 hover:text-[var(--color-sidebar-foreground)]'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
