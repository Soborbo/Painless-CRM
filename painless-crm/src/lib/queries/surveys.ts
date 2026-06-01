import { type CubicSummary, summariseCubicSheet } from '@/lib/jobs/cubic';
import { createClient } from '@/lib/supabase/server';

// Phase 10 §2/§3 — survey + cubic-sheet reads. RLS scopes to the company.

export interface SurveyRow {
  id: string;
  job_id: string;
  survey_type: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  cubic_ft_estimate: number | null;
  cubic_ft_ai_estimate: number | null;
  cubic_ft_confidence: string | null;
  complications: string[];
  notes_internal: string | null;
  notes_for_customer: string | null;
  source_video_url: string | null;
  surveyor_name: string | null;
  created_at: string;
  version: number;
}

export interface CubicItem {
  id: string;
  room: string | null;
  item: string;
  quantity: number | null;
  cubic_ft_each: number | null;
  cubic_ft_total: number | null;
  fragile: boolean | null;
  dismantle_required: boolean | null;
  notes: string | null;
}

const SURVEY_SELECT =
  'id, job_id, survey_type, scheduled_at, completed_at, cubic_ft_estimate, cubic_ft_ai_estimate, ' +
  'cubic_ft_confidence, complications, notes_internal, notes_for_customer, source_video_url, ' +
  'created_at, version, surveyor:users!surveys_surveyor_id_fkey(full_name)';

function embed<T>(raw: unknown): T | null {
  if (Array.isArray(raw)) return (raw[0] as T) ?? null;
  return (raw as T) ?? null;
}

function toSurvey(raw: Record<string, unknown>): SurveyRow {
  const surveyor = embed<{ full_name: string }>(raw.surveyor);
  const complications = Array.isArray(raw.complications) ? (raw.complications as string[]) : [];
  return {
    id: raw.id as string,
    job_id: raw.job_id as string,
    survey_type: (raw.survey_type as string | null) ?? null,
    scheduled_at: (raw.scheduled_at as string | null) ?? null,
    completed_at: (raw.completed_at as string | null) ?? null,
    cubic_ft_estimate: (raw.cubic_ft_estimate as number | null) ?? null,
    cubic_ft_ai_estimate: (raw.cubic_ft_ai_estimate as number | null) ?? null,
    cubic_ft_confidence: (raw.cubic_ft_confidence as string | null) ?? null,
    complications,
    notes_internal: (raw.notes_internal as string | null) ?? null,
    notes_for_customer: (raw.notes_for_customer as string | null) ?? null,
    source_video_url: (raw.source_video_url as string | null) ?? null,
    surveyor_name: surveyor?.full_name ?? null,
    created_at: raw.created_at as string,
    version: (raw.version as number) ?? 1,
  };
}

export async function getSurveysForJob(jobId: string): Promise<SurveyRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('surveys')
    .select(SURVEY_SELECT)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toSurvey);
}

export async function getSurvey(
  id: string,
): Promise<{ survey: SurveyRow; items: CubicItem[]; summary: CubicSummary } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('surveys')
    .select(SURVEY_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;

  const { data: itemRows } = await supabase
    .from('cubic_sheet_items')
    .select(
      'id, room, item, quantity, cubic_ft_each, cubic_ft_total, fragile, dismantle_required, notes',
    )
    .eq('survey_id', id)
    .order('room', { ascending: true });
  const items = (itemRows ?? []) as CubicItem[];

  return {
    survey: toSurvey(data as unknown as Record<string, unknown>),
    items,
    summary: summariseCubicSheet(items),
  };
}
