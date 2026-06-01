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

// Structured vertical nav for the brand sidebar. Active route is marked with a
// precise orange left rule (not a filled pill) — restrained, engineered. The
// list scrolls on its own so a long menu never overflows.
export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-2.5 py-3">
      {groups.map((group, i) => (
        <div key={group.title ?? `g${i}`} className="mb-4">
          {group.title ? (
            <div className="flex items-center gap-2 px-2 pb-1.5 pt-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-sidebar-foreground)]/45">
                {group.title}
              </span>
              <span className="h-px flex-1 bg-current/10" aria-hidden />
            </div>
          ) : null}
          <ul className="flex flex-col gap-px">
            {group.links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex items-center rounded-[3px] py-1.5 pl-3 pr-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                      active
                        ? 'bg-white/[0.07] font-semibold text-white'
                        : 'font-normal text-[var(--color-sidebar-foreground)]/75 hover:bg-white/[0.05] hover:text-[var(--color-sidebar-foreground)]'
                    }`}
                  >
                    {/* Precise left rule: solid orange when active, a faint
                        track on hover — the considered detail. */}
                    <span
                      aria-hidden
                      className={`absolute left-0 top-1/2 h-4 -translate-y-1/2 rounded-full transition-all ${
                        active
                          ? 'w-[3px] bg-[var(--color-accent)]'
                          : 'w-[3px] bg-transparent group-hover:bg-white/20'
                      }`}
                    />
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
