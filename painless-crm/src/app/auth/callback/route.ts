import { createClient } from '@/lib/supabase/server';
import { type NextRequest, NextResponse } from 'next/server';

const SAFE_NEXT = /^\/(?!\/)/;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') ?? '/dashboard';
  const next = SAFE_NEXT.test(nextParam) ? nextParam : '/dashboard';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/login?error=exchange_failed', request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
