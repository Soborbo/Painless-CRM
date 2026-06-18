// Pure transform: one Gmail `messages.get` (format=full) object -> the shape we
// insert into `email_messages` (or a typed skip). No I/O, no Supabase, no env —
// portable with auth.ts so the Gmail core can move to the sister app unchanged.
//
// Gmail returns a MIME tree: `payload.headers` is a flat [{name,value}] list and
// the body lives in `payload.body.data` (single-part) or nested `payload.parts`
// (multipart), each base64url-encoded. We pull logical headers case-insensitively
// and prefer the text/plain part for the stored body.

// Minimal structural types for the bits of a Gmail message we read. Extra
// provider fields are ignored.
export interface GmailHeader {
  name?: string;
  value?: string;
}
export interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}
export interface GmailMessage {
  id?: string;
  threadId?: string;
  historyId?: string;
  internalDate?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: GmailPart;
}

export interface MappedEmail {
  gmail_msg_id: string;
  thread_id: string | null;
  direction: 'inbound' | 'outbound';
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  subject: string | null;
  message_id_hdr: string | null;
  in_reply_to: string | null;
  snippet: string | null;
  body_text: string | null;
  /** ISO-8601, from Gmail's `internalDate` (ms since epoch). */
  internal_date: string;
}

export type ParseEmailResult =
  | { ok: true; email: MappedEmail }
  | { ok: false; reason: 'no_id' | 'no_timestamp' };

// Stored body cap — keep rows sane; the snippet covers the preview anyway.
const BODY_MAX = 16_000;

/** Lowercased, trimmed email — for mailbox comparison + storage. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed === '' ? null : trimmed;
}

/** Case-insensitive header lookup (Gmail preserves provider casing). */
export function getHeader(headers: GmailHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const want = name.toLowerCase();
  for (const h of headers) {
    if (h.name && h.name.toLowerCase() === want && typeof h.value === 'string') {
      return h.value;
    }
  }
  return null;
}

/** Split an RFC-5322 address into display name + bare email.
 *  `"Jane Doe" <jane@x.com>` / `Jane Doe <jane@x.com>` / `jane@x.com`. */
export function parseAddress(raw: string | null): { name: string | null; email: string | null } {
  if (!raw) return { name: null, email: null };
  const trimmed = raw.trim();
  const angle = /^(.*)<([^>]+)>\s*$/.exec(trimmed);
  if (angle) {
    const name = (angle[1] ?? '')
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .trim();
    return { name: name === '' ? null : name, email: normalizeEmail(angle[2]) };
  }
  if (trimmed.includes('@')) return { name: null, email: normalizeEmail(trimmed) };
  return { name: trimmed === '' ? null : trimmed, email: null };
}

/** Decode a Gmail base64url body part to a UTF-8 string. */
export function decodeBase64Url(data: string | undefined | null): string {
  if (!data) return '';
  const norm = data.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const padded = norm + '='.repeat((4 - (norm.length % 4)) % 4);
  try {
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/** Walk the MIME tree, preferring text/plain; fall back to stripped text/html;
 *  finally the part's own body. Returns null when no decodable text is found. */
export function extractBodyText(payload: GmailPart | undefined): string | null {
  if (!payload) return null;
  const plain = findPartData(payload, 'text/plain');
  if (plain !== null) return clampBody(decodeBase64Url(plain));
  const html = findPartData(payload, 'text/html');
  if (html !== null) return clampBody(stripHtml(decodeBase64Url(html)));
  if (payload.body?.data) return clampBody(decodeBase64Url(payload.body.data));
  return null;
}

function findPartData(part: GmailPart, mime: string): string | null {
  // An attachment carries a filename; skip those when hunting for the body.
  if (
    (part.mimeType ?? '').toLowerCase() === mime &&
    !part.filename &&
    typeof part.body?.data === 'string'
  ) {
    return part.body.data;
  }
  for (const child of part.parts ?? []) {
    const found = findPartData(child, mime);
    if (found !== null) return found;
  }
  return null;
}

function clampBody(s: string): string | null {
  const t = s.trim();
  if (t === '') return null;
  return t.length > BODY_MAX ? t.slice(0, BODY_MAX) : t;
}

function internalDateToIso(internalDate: string | undefined): string | null {
  if (!internalDate) return null;
  const ms = Number.parseInt(internalDate, 10);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** True when `email` is one of the tenant's own (impersonated) mailboxes. */
function isOurMailbox(mailboxes: string[], email: string | null): boolean {
  return email !== null && mailboxes.includes(email);
}

/** Pure map of one Gmail message into an `email_messages` insert shape.
 *  `mailboxes` are the tenant's own addresses, used to classify direction: a
 *  message FROM one of them is outbound, everything else inbound. */
export function parseGmailMessage(raw: GmailMessage, mailboxes: string[]): ParseEmailResult {
  if (!raw.id) return { ok: false, reason: 'no_id' };
  const internalDate = internalDateToIso(raw.internalDate);
  if (!internalDate) return { ok: false, reason: 'no_timestamp' };

  const headers = raw.payload?.headers;
  const from = parseAddress(getHeader(headers, 'From'));
  const to = parseAddress(getHeader(headers, 'To'));
  const ourBoxes = mailboxes.map((m) => normalizeEmail(m)).filter((m): m is string => m !== null);
  const direction: 'inbound' | 'outbound' = isOurMailbox(ourBoxes, from.email)
    ? 'outbound'
    : 'inbound';

  const subject = getHeader(headers, 'Subject');
  return {
    ok: true,
    email: {
      gmail_msg_id: raw.id,
      thread_id: raw.threadId ?? null,
      direction,
      from_email: from.email,
      from_name: from.name,
      to_email: to.email,
      subject: subject === null ? null : subject.slice(0, 500),
      message_id_hdr: getHeader(headers, 'Message-ID'),
      in_reply_to: getHeader(headers, 'In-Reply-To'),
      snippet: raw.snippet ? raw.snippet.slice(0, 1000) : null,
      body_text: extractBodyText(raw.payload),
      internal_date: internalDate,
    },
  };
}
