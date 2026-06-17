// TEMP DIAGNOSTIC (ADR-041): capture the real, unmasked server error behind the
// production digest for the Calls server actions, by writing it to Supabase
// (we can't read Cloudflare Workers logs from here). Remove after diagnosis.
export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string; headers?: Record<string, string> },
  context: { routePath?: string; renderSource?: string; renderType?: string },
): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const err = error as { message?: string; stack?: string; digest?: string; name?: string };
    await fetch(`${url}/rest/v1/action_error_diag`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        payload: {
          name: err?.name ?? null,
          message: err?.message ?? String(error),
          stack: (err?.stack ?? '').slice(0, 2500),
          digest: err?.digest ?? null,
          path: request?.path ?? null,
          method: request?.method ?? null,
          routePath: context?.routePath ?? null,
          renderSource: context?.renderSource ?? null,
        },
      }),
    });
  } catch {
    // best-effort
  }
}
