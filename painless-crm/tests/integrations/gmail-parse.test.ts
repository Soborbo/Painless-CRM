import {
  type GmailMessage,
  decodeBase64Url,
  extractBodyText,
  getHeader,
  normalizeEmail,
  parseAddress,
  parseGmailMessage,
} from '@/lib/integrations/gmail/parse';
import { describe, expect, it } from 'vitest';

const MAILBOX = 'info@painlessremovals.com';

// Gmail bodies are base64url.
function b64url(s: string): string {
  return Buffer.from(s, 'utf-8').toString('base64url');
}

function msg(
  overrides: Partial<GmailMessage> & { headers?: Array<{ name: string; value: string }> },
): GmailMessage {
  const { headers, payload, ...rest } = overrides;
  return {
    id: 'm1',
    threadId: 't1',
    internalDate: '1718700000000',
    snippet: 'a snippet',
    ...rest,
    payload: {
      mimeType: 'text/plain',
      body: {},
      ...payload,
      headers: headers ?? payload?.headers ?? [],
    },
  };
}

describe('normalizeEmail', () => {
  it('lowercases and trims; null on empty', () => {
    expect(normalizeEmail('  Jane@X.COM ')).toBe('jane@x.com');
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe('getHeader', () => {
  it('matches header names case-insensitively', () => {
    const headers = [
      { name: 'From', value: 'a@b.com' },
      { name: 'MESSAGE-ID', value: '<x@y>' },
    ];
    expect(getHeader(headers, 'from')).toBe('a@b.com');
    expect(getHeader(headers, 'Message-Id')).toBe('<x@y>');
    expect(getHeader(headers, 'Subject')).toBeNull();
    expect(getHeader(undefined, 'From')).toBeNull();
  });
});

describe('parseAddress', () => {
  it('splits display name and email across formats', () => {
    expect(parseAddress('"Jane Doe" <jane@example.com>')).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com',
    });
    expect(parseAddress('Jane Doe <Jane@Example.com>')).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com',
    });
    expect(parseAddress('bare@example.com')).toEqual({ name: null, email: 'bare@example.com' });
    expect(parseAddress(null)).toEqual({ name: null, email: null });
  });
});

describe('decodeBase64Url', () => {
  it('decodes url-safe base64 with missing padding + whitespace', () => {
    const raw = Buffer.from('Hello, world! — ünnep', 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(decodeBase64Url(raw)).toBe('Hello, world! — ünnep');
    expect(decodeBase64Url('')).toBe('');
    expect(decodeBase64Url(null)).toBe('');
  });
});

describe('extractBodyText', () => {
  it('prefers text/plain over text/html in a multipart body', () => {
    const body = extractBodyText({
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/html', body: { data: b64url('<p>HTML version</p>') } },
        { mimeType: 'text/plain', body: { data: b64url('Plain version') } },
      ],
    });
    expect(body).toBe('Plain version');
  });

  it('falls back to stripped html when no plain part exists', () => {
    const body = extractBodyText({
      mimeType: 'text/html',
      body: { data: b64url('<p>Hello <b>there</b></p>') },
    });
    expect(body).toBe('Hello there');
  });

  it('skips attachment parts when finding the body', () => {
    const body = extractBodyText({
      mimeType: 'multipart/mixed',
      parts: [
        { mimeType: 'text/plain', filename: 'note.txt', body: { data: b64url('attached') } },
        { mimeType: 'text/plain', body: { data: b64url('real body') } },
      ],
    });
    expect(body).toBe('real body');
  });

  it('returns null for an empty body', () => {
    expect(extractBodyText({ mimeType: 'text/plain', body: {} })).toBeNull();
    expect(extractBodyText(undefined)).toBeNull();
  });
});

describe('parseGmailMessage', () => {
  it('maps an inbound message with headers, body and direction', () => {
    const res = parseGmailMessage(
      msg({
        headers: [
          { name: 'From', value: '"Jane Doe" <jane@example.com>' },
          { name: 'To', value: MAILBOX },
          { name: 'Subject', value: 'Quote request' },
          { name: 'Message-ID', value: '<abc@mail>' },
          { name: 'In-Reply-To', value: '<prev@mail>' },
        ],
        payload: {
          mimeType: 'text/plain',
          headers: [],
          body: { data: b64url('Please quote my move.') },
        },
      }),
      [MAILBOX],
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.email).toMatchObject({
      gmail_msg_id: 'm1',
      thread_id: 't1',
      direction: 'inbound',
      from_email: 'jane@example.com',
      from_name: 'Jane Doe',
      to_email: 'info@painlessremovals.com',
      subject: 'Quote request',
      message_id_hdr: '<abc@mail>',
      in_reply_to: '<prev@mail>',
    });
    expect(res.email.internal_date).toBe(new Date(1718700000000).toISOString());
  });

  it('classifies outbound when the sender is our mailbox', () => {
    const res = parseGmailMessage(
      msg({ headers: [{ name: 'From', value: `Painless <${MAILBOX}>` }] }),
      [MAILBOX],
    );
    expect(res.ok && res.email.direction).toBe('outbound');
  });

  it('skips messages with no id or no timestamp', () => {
    expect(parseGmailMessage({ internalDate: '1', payload: {} }, [MAILBOX])).toEqual({
      ok: false,
      reason: 'no_id',
    });
    expect(parseGmailMessage({ id: 'm1', payload: {} }, [MAILBOX])).toEqual({
      ok: false,
      reason: 'no_timestamp',
    });
  });
});
