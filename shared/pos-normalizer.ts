import type { LexemePos } from './task-registry';
import type { PartOfSpeech } from './types';

export const LEGACY_PARTS_OF_SPEECH: readonly PartOfSpeech[] = [
  'V',
  'N',
  'Adj',
  'Adv',
  'Pron',
  'Det',
  'Pr\u00e4p',
  'Konj',
  'Num',
  'Part',
  'Interj',
];

export const LEXEME_PARTS_OF_SPEECH: readonly LexemePos[] = [
  'verb',
  'noun',
  'adjective',
  'adverb',
  'pronoun',
  'determiner',
  'preposition',
  'conjunction',
  'numeral',
  'particle',
  'interjection',
];

const legacyAliasMap: Record<string, PartOfSpeech> = {
  v: 'V',
  verb: 'V',
  verbs: 'V',
  verben: 'V',
  n: 'N',
  noun: 'N',
  nouns: 'N',
  nomen: 'N',
  substantiv: 'N',
  subst: 'N',
  propn: 'N',
  propernoun: 'N',
  adj: 'Adj',
  adjective: 'Adj',
  adjectives: 'Adj',
  adjektiv: 'Adj',
  adv: 'Adv',
  adverb: 'Adv',
  pron: 'Pron',
  pronoun: 'Pron',
  pronomen: 'Pron',
  det: 'Det',
  determiner: 'Det',
  art: 'Det',
  artikel: 'Det',
  prep: 'Pr\u00e4p',
  adp: 'Pr\u00e4p',
  praep: 'Pr\u00e4p',
  praeposition: 'Pr\u00e4p',
  preposition: 'Pr\u00e4p',
  'pr\u00e4p': 'Pr\u00e4p',
  'pr\u00e4position': 'Pr\u00e4p',
  'pr\u00e3\u00a4p': 'Pr\u00e4p',
  'pr\u00e3\u00a4position': 'Pr\u00e4p',
  'pr\u00e3\u0192\u00e2\u00a4p': 'Pr\u00e4p',
  konj: 'Konj',
  conj: 'Konj',
  conjunction: 'Konj',
  konjunktion: 'Konj',
  cconj: 'Konj',
  sconj: 'Konj',
  num: 'Num',
  numeral: 'Num',
  numerale: 'Num',
  zahlwort: 'Num',
  part: 'Part',
  particle: 'Part',
  partikel: 'Part',
  int: 'Interj',
  intj: 'Interj',
  interj: 'Interj',
  interjection: 'Interj',
  interjektion: 'Interj',
};

const lexemeByLegacyPos: Record<PartOfSpeech, LexemePos> = {
  V: 'verb',
  N: 'noun',
  Adj: 'adjective',
  Adv: 'adverb',
  Pron: 'pronoun',
  Det: 'determiner',
  'Pr\u00e4p': 'preposition',
  Konj: 'conjunction',
  Num: 'numeral',
  Part: 'particle',
  Interj: 'interjection',
};

function normalisePosKey(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const key = String(value)
    .trim()
    .normalize('NFC')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[\s_-]+/g, '');
  return key.length ? key : null;
}

export function normaliseLegacyPartOfSpeech(value: unknown): PartOfSpeech | null {
  const key = normalisePosKey(value);
  if (!key) {
    return null;
  }
  return legacyAliasMap[key] ?? null;
}

export function normaliseLexemePartOfSpeech(value: unknown): LexemePos | null {
  const key = normalisePosKey(value);
  if (!key) {
    return null;
  }

  if ((LEXEME_PARTS_OF_SPEECH as readonly string[]).includes(key)) {
    return key as LexemePos;
  }

  const legacy = normaliseLegacyPartOfSpeech(value);
  return legacy ? lexemeByLegacyPos[legacy] : null;
}

export function mapLegacyPartOfSpeechToLexeme(value: unknown): LexemePos | null {
  const legacy = normaliseLegacyPartOfSpeech(value);
  return legacy ? lexemeByLegacyPos[legacy] : null;
}
