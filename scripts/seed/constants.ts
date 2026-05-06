import type { PartOfSpeech } from '@shared/types';

export const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const WORDS_BATCH_SIZE = 500;

export const POS_MAP = new Map<string, PartOfSpeech>([
  ['verb', 'V'],
  ['v', 'V'],
  ['v.', 'V'],
  ['nomen', 'N'],
  ['substantiv', 'N'],
  ['noun', 'N'],
  ['n', 'N'],
  ['adj', 'Adj'],
  ['adjektiv', 'Adj'],
  ['adjective', 'Adj'],
  ['adv', 'Adv'],
  ['adverb', 'Adv'],
  ['pron', 'Pron'],
  ['pronomen', 'Pron'],
  ['det', 'Pron'],
  ['artikel', 'Pron'],
  ['präposition', 'Präp'],
  ['prep', 'Präp'],
  ['konj', 'Konj'],
  ['konjunktion', 'Konj'],
  ['num', 'Adj'],
  ['numeral', 'Adj'],
  ['part', 'Part'],
  ['partikel', 'Part'],
  ['interj', 'Part'],
  ['interjektion', 'Part'],
]);

export const EXTERNAL_POS_VALUES: readonly PartOfSpeech[] = [
  'V',
  'N',
  'Adj',
  'Adv',
  'Pron',
  'Präp',
  'Konj',
  'Part',
] as const;
