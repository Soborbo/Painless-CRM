import { requireRole } from '@/lib/auth/require-role';
import { listRecentExports } from '@/lib/queries/export-log';
import { getTranslations } from 'next-intl/server';
import { ExportsList } from './exports-list';

// SECURITY_MODEL T4: surface the bulk-export audit trail so an admin can spot a
// departing rep's exfiltration. Admin-only — the underlying RLS already scopes
// reads to the tenant, this gate keeps the page itself off limits to sales.
export default async function ExportsAuditPage() {
  await requireRole(['admin', 'super_admin']);
  const t = await getTranslations('exports');
  const rows = await listRecentExports();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('subtitle')}</p>
      </header>
      <ExportsList rows={rows} />
    </main>
  );
}
