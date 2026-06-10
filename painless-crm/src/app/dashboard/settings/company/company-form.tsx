'use client';

import { INITIAL_COMPANY_SETTINGS_STATE, updateCompanySettings } from '@/lib/actions/settings';
import type { CompanySettings } from '@/lib/queries/settings';
import { CURRENCIES, LOCALES } from '@/lib/schemas/settings';
import { DEFAULT_BRAND_COLOR } from '@/lib/settings/branding';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

const FIELD = 'rounded-md border px-3 py-2';
const LABEL = 'flex flex-col gap-1 text-sm';

export function CompanySettingsForm({ settings }: { settings: CompanySettings }) {
  const t = useTranslations('companySettings');
  const [state, action, pending] = useActionState(
    updateCompanySettings,
    INITIAL_COMPANY_SETTINGS_STATE,
  );

  return (
    <form action={action} className="mt-6 flex flex-col gap-6">
      <input type="hidden" name="version" value={settings.version} />

      <Section title={t('identity')}>
        <label className={LABEL}>
          <span>{t('companyName')} *</span>
          <input
            name="company_name"
            defaultValue={settings.company_name}
            required
            className={FIELD}
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className={LABEL}>
            <span>{t('vatNumber')}</span>
            <input name="vat_number" defaultValue={settings.vat_number ?? ''} className={FIELD} />
          </label>
          <label className={LABEL}>
            <span>{t('icoRegistration')}</span>
            <input
              name="ico_registration"
              defaultValue={settings.ico_registration ?? ''}
              className={FIELD}
            />
          </label>
        </div>
      </Section>

      <Section title={t('branding')} hint={t('brandingHint')}>
        <div className="grid grid-cols-2 gap-4">
          <label className={LABEL}>
            <span>{t('brandColor')}</span>
            <input
              type="color"
              name="brand_color"
              defaultValue={settings.brand_color ?? DEFAULT_BRAND_COLOR}
              className="h-10 w-20 rounded-md border p-1"
            />
          </label>
          <label className={LABEL}>
            <span>{t('logoUrl')}</span>
            <input
              name="logo_url"
              type="url"
              defaultValue={settings.logo_url ?? ''}
              placeholder="https://…"
              className={FIELD}
            />
          </label>
        </div>
      </Section>

      <Section title={t('defaults')}>
        <div className="grid grid-cols-2 gap-4">
          <label className={LABEL}>
            <span>{t('quoteValidityDays')}</span>
            <input
              name="default_quote_validity_days"
              type="number"
              min={1}
              max={365}
              defaultValue={settings.default_quote_validity_days}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            <span>{t('depositPercent')}</span>
            <input
              name="default_deposit_percent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={settings.default_deposit_percent}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            <span>{t('currency')}</span>
            <select
              name="default_currency"
              defaultValue={settings.default_currency}
              className={FIELD}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            <span>{t('locale')}</span>
            <select name="default_locale" defaultValue={settings.default_locale} className={FIELD}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            <span>{t('timezone')}</span>
            <input
              name="default_timezone"
              defaultValue={settings.default_timezone}
              className={FIELD}
            />
          </label>
        </div>
      </Section>

      {state.status === 'error' ? (
        <p className="text-sm text-[var(--color-danger,#dc2626)]">{state.message}</p>
      ) : null}
      {state.status === 'ok' ? (
        <p className="text-sm text-[var(--color-success,#16a34a)]">{t('saved')}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
      >
        {pending ? t('saving') : t('save')}
      </button>
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint ? <p className="text-xs text-[var(--color-muted-foreground)]">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
