import { describe, expect, it } from 'vitest';

import {
  normaliseLegacyPartOfSpeech,
  normaliseLexemePartOfSpeech,
} from '@shared/pos-normalizer';

describe('POS normalizer', () => {
  it('collapses legacy, lexeme, and external aliases to compact tags', () => {
    expect(normaliseLegacyPartOfSpeech('verb')).toBe('V');
    expect(normaliseLegacyPartOfSpeech('noun')).toBe('N');
    expect(normaliseLegacyPartOfSpeech('adjective')).toBe('Adj');
    expect(normaliseLegacyPartOfSpeech('adverb')).toBe('Adv');
    expect(normaliseLegacyPartOfSpeech('determiner')).toBe('Pron');
    expect(normaliseLegacyPartOfSpeech('preposition')).toBe('Präp');
    expect(normaliseLegacyPartOfSpeech('conjunction')).toBe('Konj');
    expect(normaliseLegacyPartOfSpeech('particle')).toBe('Part');
    expect(normaliseLegacyPartOfSpeech('numeral')).toBe('Adj');
    expect(normaliseLegacyPartOfSpeech('interjection')).toBe('Part');
  });

  it('returns compact tags for lexeme POS values', () => {
    expect(normaliseLexemePartOfSpeech('verb')).toBe('V');
    expect(normaliseLexemePartOfSpeech('noun')).toBe('N');
    expect(normaliseLexemePartOfSpeech('Präp')).toBe('Präp');
  });
});
