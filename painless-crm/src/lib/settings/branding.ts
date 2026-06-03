// Phase 18 — branding resolution. Pure helpers that turn a (possibly absent)
// settings row into the brand values merged into customer-facing document
// headers. The source of truth is the company's `settings` row, not env, and
// the merge happens at render time. See ADR-027.

export const DEFAULT_BRAND_COLOR = '#0066cc';
export const DEFAULT_COMPANY_NAME = 'Painless Removals';

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export interface BrandingSource {
  company_name?: string | null;
  brand_color?: string | null;
  logo_url?: string | null;
}

export interface Branding {
  companyName: string;
  brandColor: string;
  logoUrl: string | null;
}

export function isHexColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim());
}

// Merge a stored branding source with safe defaults. A missing or malformed
// brand colour falls back to the default rather than rendering a broken header.
export function resolveBranding(
  source: BrandingSource | null | undefined,
  fallbackName: string = DEFAULT_COMPANY_NAME,
): Branding {
  const name = source?.company_name?.trim();
  const color = source?.brand_color?.trim();
  const logo = source?.logo_url?.trim();
  return {
    companyName: name || fallbackName,
    brandColor: isHexColor(color) ? color : DEFAULT_BRAND_COLOR,
    logoUrl: logo || null,
  };
}

// Optimistic concurrency: a version-guarded UPDATE that matches no row means
// another writer advanced the version first. Supabase returns null in that
// case (with `.maybeSingle()`), which this turns into a conflict signal.
export function isVersionConflict(updatedRow: object | null): boolean {
  return updatedRow === null;
}
