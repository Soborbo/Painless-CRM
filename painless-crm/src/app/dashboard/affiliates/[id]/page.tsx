import { AffiliateCodes } from '@/components/domain/affiliate/affiliate-codes';
import { signPartnerToken } from '@/lib/affiliates/portal-tokens';
import { requireUser } from '@/lib/auth/require-role';
import { serverEnv } from '@/lib/env';
import {
  getAffiliateById,
  getAffiliateReferralSummary,
  listAffiliateCodes,
} from '@/lib/queries/affiliates';
import { formatPence } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteAffiliateButton } from './delete-button';
import { AffiliateStatusToggle } from './status-toggle';

type Props = { params: Promise<{ id: string }> };

const MANAGE_ROLES = ['manager', 'admin', 'super_admin'] as const;
const ADMIN_ROLES = ['admin', 'super_admin'] as const;

function commissionLabel(
  t: (k: string) => string,
  type: string | null,
  value: number | null,
): string {
  if (!type) return t('commission.none');
  if (type === 'percent_revenue') return `${value ?? 0}% ${t('commission.ofRevenue')}`;
  if (type === 'flat_per_job') return `${formatPence(value ?? 0)} ${t('commission.perJob')}`;
  return t('commission.tiered');
}

export default async function AffiliateDetailPage({ params }: Props) {
  const { id } = await params;
  const me = await requireUser();
  if (!(MANAGE_ROLES as readonly string[]).includes(me.role)) notFound();

  const affiliate = await getAffiliateById(id);
  if (!affiliate) notFound();

  const [codes, referrals, t] = await Promise.all([
    listAffiliateCodes(id),
    getAffiliateReferralSummary(id),
    getTranslations('affiliates'),
  ]);
  const isAdmin = (ADMIN_ROLES as readonly string[]).includes(me.role);
  const active = affiliate.active ?? false;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            <Link href="/dashboard/affiliates" className="hover:underline">
              {t('title')}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{affiliate.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {affiliate.type ? t(`types.${affiliate.type}`) : '—'} ·{' '}
            {active ? t('statusActive') : t('statusPending')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AffiliateStatusToggle id={affiliate.id} version={affiliate.version} active={active} />
          <Link
            href={`/dashboard/affiliates/${id}/edit`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--color-muted)]"
          >
            {t('edit')}
          </Link>
          {isAdmin ? (
            <DeleteAffiliateButton id={affiliate.id} version={affiliate.version} />
          ) : null}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Detail label={t('fields.contactName')}>{affiliate.contact_name ?? '—'}</Detail>
        <Detail label={t('fields.contactEmail')}>{affiliate.contact_email ?? '—'}</Detail>
        <Detail label={t('fields.contactPhone')}>{affiliate.contact_phone ?? '—'}</Detail>
        <Detail label={t('commission.heading')}>
          {commissionLabel(t, affiliate.commission_type, affiliate.commission_value)}
        </Detail>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">{t('referrals.heading')}</h2>
        <div className="grid grid-cols-3 gap-3">
          <Stat label={t('referrals.customers')} value={referrals.customers} />
          <Stat label={t('referrals.jobs')} value={referrals.jobs} />
          <Stat label={t('referrals.won')} value={referrals.wonJobs} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">{t('codes.heading')}</h2>
        <p className="mb-3 text-sm text-[var(--color-muted-foreground)]">{t('codes.intro')}</p>
        <AffiliateCodes affiliateId={affiliate.id} codes={codes} />
      </section>

      <PortalLinkSection affiliateId={affiliate.id} t={t} />
    </main>
  );
}

async function PortalLinkSection({
  affiliateId,
  t,
}: {
  affiliateId: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const env = serverEnv();
  const secret = env.QUOTE_LINK_SECRET;
  if (!secret) return null;
  const token = await signPartnerToken(affiliateId, secret);
  const url = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/partners/p/${token}`;
  return (
    <section>
      <h2 className="mb-1 text-lg font-medium">{t('portalLink.heading')}</h2>
      <p className="mb-3 text-sm text-[var(--color-muted-foreground)]">{t('portalLink.intro')}</p>
      <input
        readOnly
        value={url}
        className="w-full select-all rounded-md border bg-[var(--color-muted)] px-3 py-2 font-mono text-xs"
      />
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-4 py-3 text-center">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{label}</p>
    </div>
  );
}
