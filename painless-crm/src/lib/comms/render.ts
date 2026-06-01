// Phase 13 §4 — merge-variable rendering for message templates. Pure, so it's
// unit tested and shared by the preview UI and (later) the automation engine
// send step. Templates use {{variable}} placeholders; whitespace inside the
// braces is tolerated. Unknown variables render as empty string (a template
// should never leak raw "{{foo}}" to a customer).

export type TemplateVars = Record<string, string | number | null | undefined>;

const VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(VAR_RE, (_match, key: string) => {
    const value = vars[key];
    return value === null || value === undefined ? '' : String(value);
  });
}

// The distinct variable names a template references, in first-seen order.
export function extractVariables(template: string): string[] {
  const seen = new Set<string>();
  for (const match of template.matchAll(VAR_RE)) {
    const key = match[1];
    if (key) seen.add(key);
  }
  return [...seen];
}
