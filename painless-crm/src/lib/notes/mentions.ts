// Phase 15 — @mention parsing for notes. Pure: extracts @handles from a note
// body and resolves them against the company's users, so the note action can
// store notes.mentions[] and fan out notifications. The spec sketches a DB
// trigger (notify_mentions); doing it app-side keeps it testable and avoids a
// migration to a trigger that the notification helper already covers.

export interface MentionableUser {
  id: string;
  full_name: string | null;
}

// Matches @handle where handle starts with a letter and may contain
// word chars + dots (e.g. @tom, @tom.baker). The leading (^|[^\w@]) guard
// stops it from matching inside email addresses (foo@bar.com → the @bar is
// preceded by a word char, so it's skipped).
const MENTION_RE = /(^|[^\w@])@([a-zA-Z][\w.]*)/g;

export function parseMentionHandles(body: string): string[] {
  const out = new Set<string>();
  for (const match of body.matchAll(MENTION_RE)) {
    const handle = match[2]?.toLowerCase().replace(/\.+$/, '');
    if (handle) out.add(handle);
  }
  return [...out];
}

// The handles a given user answers to: their first name, the dotted full name,
// and first.last (so @tom, @tom.baker, @tom.alan.baker all resolve to Tom).
function handlesForUser(fullName: string | null): string[] {
  if (!fullName) return [];
  const parts = fullName.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];
  const handles = new Set<string>([parts[0] as string]);
  if (parts.length > 1) {
    handles.add(parts.join('.'));
    handles.add(`${parts[0]}.${parts[parts.length - 1]}`);
  }
  return [...handles];
}

// Resolves the @handles in `body` to user IDs. A handle that matches several
// users (two Toms via bare @tom) resolves to all of them — use @tom.baker to
// disambiguate. Returns deduped IDs; never the empty-string id.
export function resolveMentions(body: string, users: readonly MentionableUser[]): string[] {
  const handles = new Set(parseMentionHandles(body));
  if (handles.size === 0) return [];
  const ids = new Set<string>();
  for (const user of users) {
    if (!user.id) continue;
    for (const handle of handlesForUser(user.full_name)) {
      if (handles.has(handle)) {
        ids.add(user.id);
        break;
      }
    }
  }
  return [...ids];
}
