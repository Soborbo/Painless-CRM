import { getJobIntake, type IntakeAddressLeg } from '@/lib/queries/intake';
import { formatDate, formatPence } from '@/lib/utils/format';

// Read-only card surfacing the full website-calculator intake captured on a
// job (addresses, move date, resources, flags, consent, price breakdown,
// extras, attribution incl. "how did you find us?"). Renders nothing for jobs
// with no captured intake, so it is invisible on manually-created jobs.

const HEARD_ABOUT_LABELS: Record<string, string> = {
  google: 'Google search',
  friend: 'Recommendation',
  estate_agent: 'Estate agent',
  van: 'Saw our van',
  social: 'Social media',
  returning: 'Used us before',
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function AddressBlock({ leg }: { leg: IntakeAddressLeg }) {
  const lines = [leg.line1, leg.line2, leg.city, leg.postcode].filter(Boolean).join(', ');
  const access: string[] = [];
  if (leg.floor !== null) access.push(`Floor ${leg.floor}`);
  if (leg.has_lift !== null) access.push(leg.has_lift ? 'Lift' : 'No lift');
  if (leg.property_type) access.push(leg.property_type);
  return (
    <div className="rounded border border-[var(--color-border)] p-2 text-sm">
      <div className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {leg.role === 'from' ? 'From' : leg.role === 'to' ? 'To' : leg.role}
      </div>
      <div className="font-medium">{lines || '—'}</div>
      {access.length > 0 ? (
        <div className="text-[var(--color-muted-foreground)]">{access.join(' · ')}</div>
      ) : null}
      {leg.access_notes ? <div className="mt-1 italic">{leg.access_notes}</div> : null}
    </div>
  );
}

export async function IntakeDetailsPanel({ jobId }: { jobId: string }) {
  const intake = await getJobIntake(jobId);
  const d = intake.details;
  const hasDetails = Object.keys(d).length > 0;
  if (!hasDetails && intake.addresses.length === 0 && !intake.move_date) {
    return null;
  }

  const attribution = asRecord(d.attribution);
  const heardRaw = typeof attribution?.heard_about === 'string' ? attribution.heard_about : null;
  const heardLabel = heardRaw ? (HEARD_ABOUT_LABELS[heardRaw] ?? heardRaw) : null;

  const resources = asRecord(d.resources);
  const service = asRecord(d.service);
  const flags = asRecord(d.flags);
  const consent = asRecord(d.consent);
  const breakdown = asRecord(d.breakdown);
  const extras = asRecord(d.extras);

  return (
    <div className="rounded-md border p-4">
      <h3 className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
        Quote intake (website calculator)
      </h3>

      <div className="mt-3 space-y-4">
        {/* How did you find us + move/service */}
        <div>
          <Row label="How did you find us?" value={heardLabel} />
          <Row
            label="Service type"
            value={intake.service_type ? intake.service_type.replace(/_/g, ' ') : null}
          />
          <Row label="Move date" value={intake.move_date ? formatDate(intake.move_date) : null} />
          <Row
            label="Date flexibility"
            value={typeof d.date_flexibility === 'string' ? d.date_flexibility : null}
          />
        </div>

        {/* Addresses */}
        {intake.addresses.length > 0 ? (
          <div className="space-y-2">
            {intake.addresses.map((leg) => (
              <AddressBlock key={`${leg.role}-${leg.postcode}`} leg={leg} />
            ))}
          </div>
        ) : null}

        {/* Resources */}
        {resources ? (
          <div>
            <Row label="Movers" value={numOrNull(resources.men)} />
            <Row label="Vans" value={numOrNull(resources.vans)} />
            <Row
              label="Volume (cu ft)"
              value={numOrNull(resources.cubic_ft ?? null)}
            />
            <Row
              label="Est. duration (h)"
              value={numOrNull(resources.service_duration_hours ?? null)}
            />
          </div>
        ) : null}

        {/* Service sizes / slider */}
        {service ? (
          <div>
            <Row label="Property size" value={strOrNull(service.property_size)} />
            <Row label="Office size" value={strOrNull(service.office_size)} />
            <Row label="Belongings" value={strOrNull(service.slider_position)} />
          </div>
        ) : null}

        {/* Flags + consent */}
        {flags || consent ? (
          <div>
            {flags ? <Row label="Property chain" value={boolLabel(flags.property_chain)} /> : null}
            {flags ? <Row label="Key-wait waiver" value={boolLabel(flags.key_wait_waiver)} /> : null}
            {consent ? <Row label="GDPR consent" value={boolLabel(consent.gdpr)} /> : null}
            {consent ? <Row label="Marketing consent" value={boolLabel(consent.marketing)} /> : null}
          </div>
        ) : null}

        {/* Price breakdown */}
        {breakdown ? (
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Price breakdown
            </div>
            {Object.entries(breakdown).map(([k, v]) =>
              typeof v === 'number' ? (
                <Row key={k} label={k.replace(/_/g, ' ')} value={formatPence(Math.round(v))} />
              ) : null,
            )}
          </div>
        ) : null}

        {/* Extras — readable dump */}
        {extras ? (
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Extras
            </div>
            <pre className="overflow-x-auto rounded bg-[var(--color-muted)] p-2 text-xs">
              {JSON.stringify(extras, null, 2)}
            </pre>
          </div>
        ) : null}

        {/* Attribution */}
        {attribution ? (
          <div>
            <Row label="UTM source" value={strOrNull(attribution.utm_source)} />
            <Row label="UTM medium" value={strOrNull(attribution.utm_medium)} />
            <Row label="UTM campaign" value={strOrNull(attribution.utm_campaign)} />
            <Row label="gclid" value={strOrNull(attribution.gclid)} />
            <Row label="Landing page" value={strOrNull(attribution.landing_page)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
function boolLabel(v: unknown): string | null {
  return typeof v === 'boolean' ? (v ? 'Yes' : 'No') : null;
}
