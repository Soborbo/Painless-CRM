import { type MentionableUser, parseMentionHandles, resolveMentions } from '@/lib/notes/mentions';
import { describe, expect, it } from 'vitest';

const USERS: MentionableUser[] = [
  { id: 'u-tom', full_name: 'Tom Baker' },
  { id: 'u-tomh', full_name: 'Tom Hardy' },
  { id: 'u-jay', full_name: 'Jay Singh' },
  { id: 'u-noname', full_name: null },
];

describe('parseMentionHandles', () => {
  it('extracts @handles, lowercased and deduped', () => {
    expect(parseMentionHandles('Hi @Tom and @jay, also @Tom again')).toEqual(['tom', 'jay']);
  });

  it('supports dotted handles and strips trailing dots', () => {
    expect(parseMentionHandles('ping @tom.baker. now')).toEqual(['tom.baker']);
  });

  it('ignores @ inside email addresses', () => {
    expect(parseMentionHandles('mail tom@baker.com please')).toEqual([]);
  });

  it('returns nothing when there are no mentions', () => {
    expect(parseMentionHandles('just a plain note')).toEqual([]);
  });
});

describe('resolveMentions', () => {
  it('resolves a unique full handle to one user', () => {
    expect(resolveMentions('hey @tom.baker', USERS)).toEqual(['u-tom']);
  });

  it('resolves an ambiguous first-name handle to all matches', () => {
    expect(resolveMentions('@tom can you check', USERS).sort()).toEqual(['u-tom', 'u-tomh']);
  });

  it('resolves multiple distinct mentions', () => {
    expect(resolveMentions('@tom.hardy and @jay', USERS).sort()).toEqual(['u-jay', 'u-tomh']);
  });

  it('ignores handles that match no user', () => {
    expect(resolveMentions('@nobody here', USERS)).toEqual([]);
  });

  it('skips users with no name and returns empty for a note with no mentions', () => {
    expect(resolveMentions('plain note', USERS)).toEqual([]);
  });
});
