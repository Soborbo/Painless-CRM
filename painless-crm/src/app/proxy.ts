import { serverEnv } from '@/lib/env';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PREFIXES = [
  '/api/webhooks',
  '/api/cron',
  '/availability',
  '/auth/callback',
  '/quote/',
  // Phase 11 — public review-link redirect + complaints form (token-gated, no
  // login). The token is the review_request id; access is scoped by the token.
  '/r/',
  '/feedback/',
  '/api/feedback/',
];
const AUTH_PREFIXES = ['/login', '/auth'];

function isPublic(pathname: string) {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isAuthRoute(pathname: string) {
  return AUTH_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const env = serverEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isAuthRoute(pathname) && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
