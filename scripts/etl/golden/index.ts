import type { PartOfSpeech } from '@shared';
import { mapLegacyPartOfSpeechToLexeme } from '@shared/pos-normalizer';
import { type LexemePos } from '@shared/task-registry';
import { B2_BERUF_COLLECTION } from '@shared/content-sources';

import { generateTaskSpecs, type TaskTemplateSource } from '../../../server/tasks/templates.ts';

import type { AggregatedWord } from '../types';
import { stableStringify, sha1 } from '../utils';
import {
  buildAttributionSummary,
  collectSources,
  deriveSourceRevision,
  primarySourceId,
} from './attribution';
import { validateGoldenWord } from './validation';
import {
  type InflectionSeed,
  type LexemeInventory,
  type LexemeSeed,
  type TaskInventory,
  type TaskSpecSeed,
} from './types';

export function buildTaskInventory(words: AggregatedWord[]): TaskInventory {
  const tasks: TaskSpecSeed[] = [];
  const lexemeIds = createLexemeIdResolver(words);

  for (const word of words) {
    validateGoldenWord(word);

    const taskSource = createTaskSourceFromWord(word, lexemeIds(word));
    const generatedTasks = generateTaskSpecs(taskSource);
    for (const task of generatedTasks) {
      tasks.push({
        id: task.id,
        lexemeId: task.lexemeId,
        pos: task.pos,
        taskType: task.taskType,
        renderer: task.renderer,
        prompt: task.prompt,
        solution: task.solution,
        hints: task.hints,
        metadata: task.metadata,
        revision: task.revision,
      });
    }
  }

  const ordered = tasks.sort((a, b) => {
    const lexemeCompare = a.lexemeId.localeCompare(b.lexemeId);
    if (lexemeCompare !== 0) return lexemeCompare;
    return a.id.localeCompare(b.id);
  });

  return { tasks: ordered };
}

export function buildLexemeInventory(words: AggregatedWord[]): LexemeInventory {
  const lexemeMap = new Map<string, LexemeSeed>();
  const allInflections: InflectionSeed[] = [];
  const lexemeIds = createLexemeIdResolver(words);

  for (const word of words) {
    validateGoldenWord(word);
    const lexeme = createLexemeSeed(word, lexemeIds(word));
    if (!lexemeMap.has(lexeme.id)) {
      lexemeMap.set(lexeme.id, lexeme);
    }
    const lexemeInflections = createInflectionsForWord(word, lexeme.id);
    allInflections.push(...lexemeInflections);
  }

  const lexemes = Array.from(lexemeMap.values()).sort((a, b) => {
    const lemmaCompare = a.lemma.localeCompare(b.lemma, 'de');
    if (lemmaCompare !== 0) return lemmaCompare;
    return a.id.localeCompare(b.id);
  });

  const inflections = dedupeInflections(allInflections).sort((a, b) => {
    const lexemeCompare = a.lexemeId.localeCompare(b.lexemeId);
    if (lexemeCompare !== 0) return lexemeCompare;
    return a.form.localeCompare(b.form, 'de');
  });

  return {
    lexemes,
    inflections,
    attribution: buildAttributionSummary(words),
  };
}

function createLexemeSeed(word: AggregatedWord, lexemeId: string): LexemeSeed {
  const pos = mapPos(word.pos);
  const collections = getCollections(word);
  const level = canonicalLevel(word);
  const metadata: Record<string, unknown> = {
    level: level ?? undefined,
    english: word.english ?? undefined,
    example: normaliseExample(word.exampleDe, word.exampleEn),
    separable: word.separable ?? undefined,
    auxiliary: word.aux ?? undefined,
    perfekt: word.perfekt ?? undefined,
    collections: collections.length ? collections : undefined,
  };

  const tags = word.posAttributes?.tags ?? null;
  if (Array.isArray(tags) && tags.length > 0) {
    metadata.tags = Array.from(new Set(tags)).sort();
  }

  const posNotes = word.posAttributes?.notes ?? null;
  if (Array.isArray(posNotes) && posNotes.length > 0) {
    metadata.posNotes = [...posNotes];
  }

  const prepositionAttributes = word.posAttributes?.preposition ?? null;
  if (prepositionAttributes) {
    const payload: Record<string, unknown> = {};
    if (Array.isArray(prepositionAttributes.cases) && prepositionAttributes.cases.length > 0) {
      payload.cases = [...prepositionAttributes.cases];
    }
    if (Array.isArray(prepositionAttributes.notes) && prepositionAttributes.notes.length > 0) {
      payload.notes = [...prepositionAttributes.notes];
    }
    if (Object.keys(payload).length > 0) {
      metadata.preposition = payload;
    }
  }

  if (!metadata.example) {
    delete metadata.example;
  }

  const cleanedMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null),
  );

  return {
    id: lexemeId,
    lemma: word.lemma,
    language: 'de',
    pos,
    gender: pos === 'noun' ? word.gender ?? null : null,
    metadata: cleanedMetadata,
    frequencyRank: null,
    sourceIds: collectSources(word),
  };
}

function createLexemeIdResolver(words: AggregatedWord[]): (word: AggregatedWord) => string {
  const entries = words.map((word) => {
    const base = createLexemeIdParts(word);
    const exactKey = `${base.pos}:${word.lemma.normalize('NFKC').toLocaleLowerCase('de')}:${base.primarySource}`;
    return { word, baseKey: base.hashInput, exactKey };
  });
  const exactKeysByBase = new Map<string, Set<string>>();
  for (const entry of entries) {
    const exactKeys = exactKeysByBase.get(entry.baseKey) ?? new Set<string>();
    exactKeys.add(entry.exactKey);
    exactKeysByBase.set(entry.baseKey, exactKeys);
  }

  const disambiguators = new Map<string, string>();
  for (const [baseKey, exactKeys] of exactKeysByBase) {
    if (exactKeys.size <= 1) {
      continue;
    }
    const ordered = Array.from(exactKeys).sort((left, right) => left.localeCompare(right, 'de'));
    for (const exactKey of ordered.slice(1)) {
      disambiguators.set(`${baseKey}\0${exactKey}`, exactKey);
    }
  }

  return (word) => {
    const base = createLexemeIdParts(word);
    const exactKey = `${base.pos}:${word.lemma.normalize('NFKC').toLocaleLowerCase('de')}:${base.primarySource}`;
    const disambiguator = disambiguators.get(`${base.hashInput}\0${exactKey}`);
    const hashInput = disambiguator ? `${base.hashInput}:${disambiguator}` : base.hashInput;
    const idHash = sha1(hashInput);
    return `de:${base.pos}:${base.lemmaSlug}:${idHash.slice(0, 8)}`;
  };
}

function createLexemeIdParts(word: AggregatedWord): {
  pos: LexemePos;
  lemmaSlug: string;
  primarySource: string;
  hashInput: string;
} {
  const pos = mapPos(word.pos);
  const lemmaSlug = normaliseLemma(word.lemma);
  const primarySource = primarySourceId(word);
  return {
    pos,
    lemmaSlug,
    primarySource,
    hashInput: `${pos}:${lemmaSlug}:${primarySource}`,
  };
}

function createInflectionsForWord(word: AggregatedWord, lexemeId: string): InflectionSeed[] {
  const pos = mapPos(word.pos);
  const base: InflectionSeed[] = [];
  const sourceRevision = deriveSourceRevision(word);

  if (pos === 'verb') {
    base.push(
      ...createInflectionEntries(
        lexemeId,
        [
          {
            form: word.lemma,
            features: { tense: 'infinitive', mood: 'indicative' },
          },
          word.praesensIch
            ? {
                form: word.praesensIch,
                features: { tense: 'present', mood: 'indicative', person: 1, number: 'singular' },
              }
            : undefined,
          word.praesensEr
            ? {
                form: word.praesensEr,
                features: { tense: 'present', mood: 'indicative', person: 3, number: 'singular' },
              }
            : undefined,
          word.praeteritum
            ? {
                form: word.praeteritum,
                features: { tense: 'past', mood: 'indicative', person: 3, number: 'singular' },
              }
            : undefined,
          word.partizipIi
            ? {
                form: word.partizipIi,
                features: { tense: 'participle', aspect: 'perfect' },
              }
            : undefined,
          word.perfekt
            ? {
                form: word.perfekt,
                features: { tense: 'perfect', auxiliary: word.aux ?? undefined },
              }
            : undefined,
        ],
        sourceRevision,
      ),
    );
  } else if (pos === 'noun') {
    base.push(
      ...createInflectionEntries(
        lexemeId,
        [
          {
            form: word.lemma,
            features: { case: 'nominative', number: 'singular', gender: word.gender ?? undefined },
          },
          word.plural
            ? {
                form: word.plural,
                features: { case: 'nominative', number: 'plural' },
              }
            : undefined,
        ],
        sourceRevision,
      ),
    );
  } else if (pos === 'adjective') {
    base.push(
      ...createInflectionEntries(
        lexemeId,
        [
          {
            form: word.lemma,
            features: { degree: 'positive' },
          },
          word.comparative
            ? {
                form: word.comparative,
                features: { degree: 'comparative' },
              }
            : undefined,
          word.superlative
            ? {
                form: word.superlative,
                features: { degree: 'superlative' },
              }
            : undefined,
        ],
        sourceRevision,
      ),
    );
  } else if (pos === 'adverb') {
    base.push(
      ...createInflectionEntries(
        lexemeId,
        [
          {
            form: word.lemma,
            features: { degree: 'positive' },
          },
          word.comparative
            ? {
                form: word.comparative,
                features: { degree: 'comparative' },
              }
            : undefined,
          word.superlative
            ? {
                form: word.superlative,
                features: { degree: 'superlative' },
              }
            : undefined,
        ],
        sourceRevision,
      ),
    );
  } else if (pos === 'preposition') {
    const governedCases = word.posAttributes?.preposition?.cases ?? null;
    base.push(
      ...createInflectionEntries(
        lexemeId,
        [
          {
            form: word.lemma,
            features: {
              slot: 'lemma',
              governedCases:
                Array.isArray(governedCases) && governedCases.length > 0 ? governedCases : undefined,
            },
          },
        ],
        sourceRevision,
      ),
    );
  } else {
    base.push(
      ...createInflectionEntries(
        lexemeId,
        [
          {
            form: word.lemma,
            features: { slot: 'lemma' },
          },
        ],
        sourceRevision,
      ),
    );
  }

  const unique = dedupeInflections(base);
  return unique;
}

function createTaskSourceFromWord(word: AggregatedWord, lexemeId: string): TaskTemplateSource {
  const pos = mapPos(word.pos);

  return {
    lexemeId,
    lemma: word.lemma,
    pos,
    level: canonicalLevel(word),
    collections: getCollections(word),
    english: word.english ?? null,
    exampleDe: word.exampleDe ?? null,
    exampleEn: word.exampleEn ?? null,
    gender: pos === 'noun' ? word.gender ?? null : null,
    plural: word.plural ?? null,
    separable: typeof word.separable === 'boolean' ? word.separable : null,
    aux: word.aux ?? null,
    praesensIch: word.praesensIch ?? null,
    praesensEr: word.praesensEr ?? null,
    praeteritum: word.praeteritum ?? null,
    partizipIi: word.partizipIi ?? null,
    perfekt: word.perfekt ?? null,
    comparative: word.comparative ?? null,
    superlative: word.superlative ?? null,
  } satisfies TaskTemplateSource;
}

function canonicalLevel(word: AggregatedWord): string | null {
  const collections = getCollections(word);
  if (collections.includes(B2_BERUF_COLLECTION)) {
    return 'B2';
  }
  return word.level ?? null;
}

function getCollections(word: AggregatedWord): string[] {
  const normalized = Array.isArray(word.collections)
    ? word.collections
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value): value is string => value.length > 0)
    : [];
  return Array.from(new Set(normalized)).sort();
}

function createInflectionEntries(
  lexemeId: string,
  entries: Array<{ form: string | null; features: Record<string, unknown> } | undefined>,
  sourceRevision: string,
): InflectionSeed[] {
  const seeds: InflectionSeed[] = [];
  for (const entry of entries) {
    if (!entry?.form) continue;
    const featurePayload = pruneUndefined(entry.features);
    const checksum = sha1(stableStringify({ form: entry.form, features: featurePayload }));
    seeds.push({
      id: createInflectionId(lexemeId, featurePayload, entry.form),
      lexemeId,
      form: entry.form,
      features: featurePayload,
      audioAsset: null,
      sourceRevision,
      checksum: checksum.slice(0, 16),
    });
  }
  return seeds;
}

function dedupeInflections(inflections: InflectionSeed[]): InflectionSeed[] {
  const seen = new Map<string, InflectionSeed>();
  for (const inflection of inflections) {
    if (!seen.has(inflection.id)) {
      seen.set(inflection.id, inflection);
    }
  }
  return Array.from(seen.values());
}

function createInflectionId(
  lexemeId: string,
  features: Record<string, unknown>,
  form: string,
): string {
  const hash = sha1(stableStringify({ lexemeId, features, form })).slice(0, 10);
  return `inf:${lexemeId}:${hash}`;
}

function normaliseLemma(lemma: string): string {
  return lemma
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function normaliseExample(
  exampleDe: string | null,
  exampleEn: string | null,
):
  | {
      de?: string;
      en?: string;
    }
  | undefined {
  const payload: { de?: string; en?: string } = {};
  if (exampleDe) payload.de = exampleDe;
  if (exampleEn) payload.en = exampleEn;
  return Object.keys(payload).length ? payload : undefined;
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined && v !== null);
  return Object.fromEntries(entries) as T;
}

function mapPos(pos: PartOfSpeech): LexemePos {
  const mapped = mapLegacyPartOfSpeechToLexeme(pos);
  if (mapped) {
    return mapped;
  }
  switch (pos) {
    case 'V':
      return 'verb';
    case 'N':
      return 'noun';
    case 'Adj':
      return 'adjective';
    case 'Adv':
      return 'adverb';
    case 'Pron':
      return 'pronoun';
    case 'Det':
      return 'determiner';
    case 'Präp':
      return 'preposition';
    case 'Konj':
      return 'conjunction';
    case 'Num':
      return 'numeral';
    case 'Part':
      return 'particle';
    case 'Interj':
      return 'interjection';
    default:
      throw new Error(`Unsupported part of speech in task inventory: ${pos}`);
  }
}

export { upsertLexemeInventory, upsertTaskInventory } from './persistence';
export type {
  InflectionSeed,
  LexemeInventory,
  LexemeSeed,
  TaskInventory,
  TaskSpecSeed,
} from './types';
