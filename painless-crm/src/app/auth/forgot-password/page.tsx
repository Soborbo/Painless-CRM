import { getTranslations } from 'next-intl/server';
import { ForgotPasswordForm } from './forgot-form';

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth');
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">{t('forgotPassword')}</h1>
      <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">{t('forgotPasswordHelp')}</p>
      <ForgotPasswordForm />
    </main>
  );
}
