import { CustomerForm } from '@/components/domain/customer/customer-form';
import { requireRole } from '@/lib/auth/require-role';
import { getCustomerById } from '@/lib/queries/customers';
import { customerDisplayName } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

export default async function EditCustomerPage({ params }: Props) {
  const { id } = await params;
  await requireRole(['sales', 'manager', 'admin', 'super_admin']);
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  const t = await getTranslations('customers');

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('edit')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {customerDisplayName(customer)}
        </p>
      </header>
      <CustomerForm
        mode="edit"
        id={customer.id}
        version={customer.version}
        defaults={{
          customer_type: customer.customer_type,
          first_name: customer.first_name ?? '',
          last_name: customer.last_name ?? '',
          company_name: customer.company_name ?? '',
          vat_number: customer.vat_number ?? '',
          payment_terms_days:
            customer.payment_terms_days !== null && customer.payment_terms_days !== undefined
              ? String(customer.payment_terms_days)
              : '',
          primary_email: customer.primary_email ?? '',
          primary_phone: customer.primary_phone ?? '',
          acquisition_source: customer.acquisition_source ?? '',
          acquisition_campaign: '',
          marketing_consent: customer.marketing_consent,
          notes: customer.notes ?? '',
        }}
      />
    </main>
  );
}
