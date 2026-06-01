import { VehicleForm } from '@/components/domain/vehicle/vehicle-form';
import { requireRole } from '@/lib/auth/require-role';
import { getVehicleById } from '@/lib/queries/vehicles';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

export default async function EditVehiclePage({ params }: Props) {
  const { id } = await params;
  await requireRole(['manager', 'admin', 'super_admin']);
  const vehicle = await getVehicleById(id);
  if (!vehicle) notFound();

  const t = await getTranslations('vehicles');

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('edit')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{vehicle.registration}</p>
      </header>
      <VehicleForm
        mode="edit"
        id={vehicle.id}
        version={vehicle.version}
        defaults={{
          registration: vehicle.registration,
          type: vehicle.type ?? 'luton',
          capacity_cubic_ft:
            vehicle.capacity_cubic_ft != null ? String(vehicle.capacity_cubic_ft) : '',
          monthly_cost_pounds:
            vehicle.monthly_cost_pence != null ? (vehicle.monthly_cost_pence / 100).toFixed(2) : '',
          active: vehicle.active,
          compliance_alerts_enabled: vehicle.compliance_alerts_enabled,
          mot_due: vehicle.mot_due ?? '',
          tax_due: vehicle.tax_due ?? '',
          insurance_due: vehicle.insurance_due ?? '',
          next_service_due: vehicle.next_service_due ?? '',
        }}
      />
    </main>
  );
}
