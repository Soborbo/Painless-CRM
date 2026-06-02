import { AffiliateForm } from '@/components/domain/affiliate/affiliate-form';
import { requireRole } from '@/lib/auth/require-role';
import { getAffiliateById } from '@/lib/queries/affiliates';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

// Flat commission is stored as pence; show it back in £ on the form.
function commissionValueForForm(type: string | null, value: number | null): string {
  if (value == null) return '';
  if (type === 'flat_per_job') return (value / 100).toString();
  return value.toString();
}

export default async function EditAffiliatePage({ params }: Props) {
  const { id } = await params;
  await requireRole(['manager', 'admin', 'super_admin']);
  const affiliate = await getAffiliateById(id);
  if (!affiliate) notFound();

  const t = await getTranslations('affiliates');

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('editTitle')}</h1>
      </header>
      <AffiliateForm
        mode="edit"
        id={affiliate.id}
        version={affiliate.version}
        defaults={{
          name: affiliate.name,
          type: affiliate.type ?? 'B2B_partner',
          contact_name: affiliate.contact_name ?? '',
          contact_email: affiliate.contact_email ?? '',
          contact_phone: affiliate.contact_phone ?? '',
          commission_type: affiliate.commission_type ?? '',
          commission_value: commissionValueForForm(
            affiliate.commission_type,
            affiliate.commission_value,
          ),
          active: affiliate.active ?? false,
        }}
      />
    </main>
  );
}
