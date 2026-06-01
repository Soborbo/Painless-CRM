import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'Painless CRM',
  description: 'Operations CRM for Painless Removals',
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint to avoid a flash.
            No stored choice → the CSS media query follows the OS. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: tiny inline theme bootstrap, no user input
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var c=document.documentElement.classList;if(t==='dark'){c.add('dark')}else if(t==='light'){c.add('light')}}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
