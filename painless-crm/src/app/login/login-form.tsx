'use client';

import { type ActionState, sendMagicLink, signInWithPassword } from '@/lib/auth/actions';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState, useState } from 'react';

const INITIAL_STATE: ActionState = { ok: false };

export function LoginForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const params = useSearchParams();
  const [mode, setMode] = useState<'password' | 'magic'>('password');

  const [pwState, pwAction, pwPending] = useActionState(signInWithPassword, INITIAL_STATE);
  const [mlState, mlAction, mlPending] = useActionState(sendMagicLink, INITIAL_STATE);

  const next = params.get('next') ?? '/dashboard';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 text-sm" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'password'}
          onClick={() => setMode('password')}
          className={`rounded-md px-3 py-1.5 ${mode === 'password' ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border'}`}
        >
          {t('password')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'magic'}
          onClick={() => setMode('magic')}
          className={`rounded-md px-3 py-1.5 ${mode === 'magic' ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border'}`}
        >
          {t('magicLink')}
        </button>
      </div>

      {mode === 'password' ? (
        <form action={pwAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <label className="flex flex-col gap-1 text-sm">
            {t('email')}
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded-md border px-3 py-2 outline-none focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t('password')}
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              minLength={8}
              className="rounded-md border px-3 py-2 outline-none focus:ring-2"
            />
          </label>
          {pwState.message ? (
            <p className={`text-sm ${pwState.ok ? '' : 'text-[var(--color-danger)]'}`}>
              {pwState.message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pwPending}
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pwPending ? tc('loading') : t('signIn')}
          </button>
          <Link href="/auth/forgot-password" className="self-start text-xs underline">
            {t('forgotPassword')}
          </Link>
        </form>
      ) : (
        <form action={mlAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            {t('email')}
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded-md border px-3 py-2 outline-none focus:ring-2"
            />
          </label>
          {mlState.message ? (
            <p className={`text-sm ${mlState.ok ? '' : 'text-[var(--color-danger)]'}`}>
              {mlState.message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={mlPending}
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {mlPending ? tc('loading') : t('magicLink')}
          </button>
        </form>
      )}
    </div>
  );
}
