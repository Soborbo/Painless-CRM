import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'hu'] as const;
export const defaultLocale = 'en';
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  const locale: Locale = defaultLocale;
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
