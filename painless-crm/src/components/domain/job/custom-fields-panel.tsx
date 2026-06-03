import { getCustomFieldDefsForCompany, getJobCustomFields } from '@/lib/queries/custom-fields';
import { getTranslations } from 'next-intl/server';
import { CustomFieldsForm } from './custom-fields-form';

// Phase 25a — job custom fields card. Renders nothing when the tenant has not
// defined any fields, so it is invisible until configured.
export async function CustomFieldsPanel({
  jobId,
  companyId,
}: {
  jobId: string;
  companyId: string;
}) {
  const defs = await getCustomFieldDefsForCompany(companyId);
  if (defs.length === 0) return null;

  const [values, t] = await Promise.all([
    getJobCustomFields(jobId),
    getTranslations('customFields'),
  ]);

  return (
    <div className="rounded-md border p-4">
      <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t('panelTitle')}
      </h3>
      <div className="mt-3">
        <CustomFieldsForm jobId={jobId} defs={defs} values={values} />
      </div>
    </div>
  );
}
