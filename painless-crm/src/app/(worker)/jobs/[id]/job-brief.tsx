import type { JobBrief } from '@/lib/calendar/brief';
import { getTranslations } from 'next-intl/server';

// The crew job brief on the worker PWA (ADR-045): the same audience-filtered
// brief the calendar event carries, rendered as mobile sections so the van team
// has addresses + access, kit, dismantle/reassemble, "not going" and notes on
// the job itself — not just a date and a pick-up address.

export async function WorkerBriefCard({ brief }: { brief: JobBrief | null }) {
  if (!brief) return null;
  const t = await getTranslations('workerApp');
  const notes = [...brief.internalNotes, ...brief.customerNotes];
  const hasContent =
    brief.legs.length > 0 ||
    brief.kit.length > 0 ||
    brief.dismantle.length > 0 ||
    brief.reassembly.length > 0 ||
    brief.excluded.length > 0 ||
    notes.length > 0;
  if (!hasContent) return null;

  const meta = (leg: JobBrief['legs'][number]): string =>
    [
      leg.property_type,
      leg.floor != null ? t('brief.floor', { floor: leg.floor }) : null,
      leg.has_lift != null ? t(leg.has_lift ? 'brief.lift' : 'brief.noLift') : null,
      leg.has_parking != null ? t(leg.has_parking ? 'brief.parking' : 'brief.noParking') : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-3 font-medium">{t('brief.heading')}</h2>
      <div className="flex flex-col gap-3 text-sm">
        {brief.legs.map((leg) => (
          <div key={`${leg.role}-${leg.address}`}>
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t(`brief.${leg.role}` as never)}
            </p>
            <p>{leg.address}</p>
            {meta(leg) ? (
              <p className="text-xs text-[var(--color-muted-foreground)]">{meta(leg)}</p>
            ) : null}
            {leg.access_notes ? (
              <p className="text-xs">
                <span className="text-[var(--color-muted-foreground)]">{t('brief.access')}:</span>{' '}
                {leg.access_notes}
              </p>
            ) : null}
          </div>
        ))}

        <ItemList
          title={t('brief.kit')}
          lines={brief.kit.map((i) => `${i.quantity}× ${i.item}${i.notes ? ` — ${i.notes}` : ''}`)}
        />
        <ItemList
          title={t('brief.dismantle')}
          lines={brief.dismantle.map(
            (i) => `${i.quantity}× ${i.item}${i.room ? ` (${i.room})` : ''}`,
          )}
        />
        <ItemList
          title={t('brief.reassemble')}
          lines={brief.reassembly.map(
            (i) => `${i.quantity}× ${i.item}${i.room ? ` (${i.room})` : ''}`,
          )}
        />
        <ItemList
          title={t('brief.excluded')}
          lines={brief.excluded.map(
            (i) => `${i.quantity}× ${i.item}${i.notes ? ` — ${i.notes}` : ''}`,
          )}
        />
        <ItemList title={t('brief.notes')} lines={notes} />
      </div>
    </section>
  );
}

function ItemList({ title, lines }: { title: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {title}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
