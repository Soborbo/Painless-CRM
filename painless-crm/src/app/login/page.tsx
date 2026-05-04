import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const t = await getTranslations('auth');

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t('signIn')}</h1>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
