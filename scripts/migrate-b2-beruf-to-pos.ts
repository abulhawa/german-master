import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseCsv } from 'csv-parse/sync';

import { B2_BERUF_COLLECTION } from '@shared/content-sources';
import { normaliseLegacyPartOfSpeech } from '@shared/pos-normalizer';
import type { PartOfSpeech } from '@shared/types';

type SupportedPos =
  | 'V'
  | 'N'
  | 'Adj'
  | 'Adv'
  | 'Präp'
  | 'Konj'
  | 'Pron'
  | 'Part';

interface ParsedCsvRow {
  articlePrefix: string;
  word: string;
  english: string;
  exampleDe: string;
  exampleEn: string;
  posRaw: string;
}

interface NormalizedB2Entry {
  key: string;
  pos: SupportedPos;
  lemma: string;
  level: 'B2';
  englishPrimary: string;
  englishValues: string[];
  examples: Array<{ sentence: string; en: string }>;
  gender: string | null;
  plural: string | null;
}

interface CleanupCounters {
  rowsProcessed: number;
  wordParenthesesRemoved: number;
  wordReflexiveNormalized: number;
  wordMetadataRemoved: number;
  nounCapitalized: number;
  englishParenthesesRemoved: number;
  englishSuffixNormalized: number;
}

const POS_FILENAME_MAP: Record<SupportedPos, string> = {
  V: 'verbs.jsonl',
  N: 'nouns.jsonl',
  Adj: 'adjectives.jsonl',
  Adv: 'adverbs.jsonl',
  Präp: 'prepositions.jsonl',
  Konj: 'conjunctions.jsonl',
  Pron: 'pronouns.jsonl',
  Part: 'particles.jsonl',
};

function encodeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function sanitizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function cleanWord(value: string, counters: CleanupCounters): string {
  let next = sanitizeWhitespace(value);

  const reflexivePattern = /\((sich)\)/gi;
  if (reflexivePattern.test(next)) {
    counters.wordReflexiveNormalized += 1;
    next = next.replace(reflexivePattern, '$1');
  }

  const removedParentheses = next.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (removedParentheses !== next) {
    counters.wordParenthesesRemoved += 1;
    counters.wordMetadataRemoved += 1;
    next = removedParentheses;
  }

  return next
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;:])/g, '$1')
    .trim();
}

function cleanEnglish(value: string, counters: CleanupCounters): string {
  let next = sanitizeWhitespace(value);
  const initial = next;

  next = next.replace(/^\(to\)\s*/i, 'to ');

  next = next
    .replace(/\((?:dat|date|akk|acc|adj|adv|pl|sg|s)\.?\)/gi, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;:])/g, '$1')
    .replace(/[;,]+$/g, '')
    .trim();

  if (next !== initial) {
    counters.englishSuffixNormalized += 1;
  }
  if (/\([^)]*\)/.test(initial)) {
    counters.englishParenthesesRemoved += 1;
  }

  return next;
}

function normalizeNounLemma(lemma: string, counters: CleanupCounters): string {
  const trimmed = lemma.trim();
  if (!trimmed) {
    return trimmed;
  }
  const first = trimmed[0];
  if (!first) {
    return trimmed;
  }
  const capitalized = first.toLocaleUpperCase('de-DE') + trimmed.slice(1);
  if (capitalized !== trimmed) {
    counters.nounCapitalized += 1;
  }
  return capitalized;
}

function splitLemmaAndPlural(word: string, pos: SupportedPos, counters: CleanupCounters): {
  lemma: string;
  plural: string | null;
  normalizedWord: string;
} {
  if (pos !== 'N') {
    return { lemma: word.trim(), plural: null, normalizedWord: word.trim() };
  }

  const [rawLemma, ...rest] = word.split(',');
  const lemma = normalizeNounLemma(rawLemma?.trim() ?? '', counters);
  const pluralCandidate = rest.join(',').trim();
  const plural = pluralCandidate.length > 0 ? pluralCandidate : null;
  const normalizedWord = plural ? `${lemma}, ${plural}` : lemma;

  return { lemma, plural, normalizedWord };
}

function inferGender(articlePrefix: string): string | null {
  const normalized = ` ${articlePrefix.toLowerCase()} `
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00fc/g, 'ue')
    .replace(/\u00df/g, 'ss');

  const hasDer = /\bder\b/.test(normalized);
  const hasDie = /\bdie\b/.test(normalized);
  const hasDas = /\bdas\b/.test(normalized);

  const genders = [
    hasDer ? 'der' : null,
    hasDie ? 'die' : null,
    hasDas ? 'das' : null,
  ].filter((value): value is 'der' | 'die' | 'das' => Boolean(value));

  return genders.length > 0 ? genders.join('/') : null;
}

function normalizePos(raw: string): SupportedPos | null {
  const normalized = normaliseLegacyPartOfSpeech(raw);
  if (!normalized) {
    return null;
  }
  if (
    normalized === 'V' ||
    normalized === 'N' ||
    normalized === 'Adj' ||
    normalized === 'Adv' ||
    normalized === 'Präp' ||
    normalized === 'Konj' ||
    normalized === 'Pron' ||
    normalized === 'Part'
  ) {
    return normalized;
  }
  return null;
}

function createKey(lemma: string, pos: PartOfSpeech): string {
  return `${lemma.toLocaleLowerCase('de-DE')}::${pos}`;
}

function normalizeCsvRecords(input: string): ParsedCsvRow[] {
  const records = parseCsv(input, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  return records.map((record) => ({
    articlePrefix: record['Article/Prefix'] ?? '',
    word: record['Word'] ?? '',
    english: record['English Translation'] ?? '',
    exampleDe: record['Example Sentence'] ?? '',
    exampleEn: record['English Translation (Sentence)'] ?? '',
    posRaw: record['POS'] ?? '',
  }));
}

function formatCsv(records: ParsedCsvRow[]): string {
  const header = [
    'Article/Prefix',
    'Word',
    'English Translation',
    'Example Sentence',
    'English Translation (Sentence)',
    'POS',
  ];
  const lines = [header.join(',')];

  for (const row of records) {
    const values = [
      row.articlePrefix,
      row.word,
      row.english,
      row.exampleDe,
      row.exampleEn,
      row.posRaw,
    ].map(encodeCsvField);
    lines.push(values.join(','));
  }

  return `${lines.join('\n')}\n`;
}

function mergeStringList(existing: string[] | undefined, incoming: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const value of [...(existing ?? []), ...incoming]) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLocaleLowerCase('de-DE');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(trimmed);
  }

  return merged;
}

function normalizeExamplesFromRecord(record: unknown): Array<{ sentence: string; en: string }> {
  if (!Array.isArray(record)) {
    return [];
  }

  const seen = new Set<string>();
  const result: Array<{ sentence: string; en: string }> = [];
  for (const entry of record) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const exampleRecord = entry as Record<string, unknown>;
    const sentenceValue = exampleRecord.sentence;
    const sentence =
      typeof sentenceValue === 'string'
        ? sentenceValue.trim()
        : '';
    const translationsValue = exampleRecord.translations;
    const enRaw =
      translationsValue && typeof translationsValue === 'object'
        ? (translationsValue as Record<string, unknown>)
        : null;
    const en = typeof enRaw?.en === 'string' ? enRaw.en.trim() : '';
    if (!sentence || !en) {
      continue;
    }
    const key = `${sentence.toLocaleLowerCase('de-DE')}::${en.toLocaleLowerCase('en-US')}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ sentence, en });
  }
  return result;
}

function toExamplePayload(examples: Array<{ sentence: string; en: string }>) {
  if (!examples.length) {
    return undefined;
  }
  return examples.map((entry) => ({
    sentence: entry.sentence,
    translations: { en: entry.en },
  }));
}

function toTranslationPayload(values: string[]) {
  if (values.length <= 1) {
    return undefined;
  }

  return values.map((value) => ({
    value,
    language: 'en',
    source: 'b2_beruf_csv',
    confidence: null,
  }));
}

function sortRecords(records: Array<Record<string, unknown>>) {
  records.sort((a, b) => {
    const lemmaA = typeof a.lemma === 'string' ? a.lemma : '';
    const lemmaB = typeof b.lemma === 'string' ? b.lemma : '';
    const lemmaOrder = lemmaA.localeCompare(lemmaB, 'de-DE');
    if (lemmaOrder !== 0) {
      return lemmaOrder;
    }
    return JSON.stringify(a).localeCompare(JSON.stringify(b), 'en-US');
  });
}

function buildRecordFromB2Entry(entry: NormalizedB2Entry): Record<string, unknown> {
  const base: Record<string, unknown> = {
    lemma: entry.lemma,
    level: 'B2',
    english: entry.englishPrimary,
    approved: true,
    collections: [B2_BERUF_COLLECTION],
  };

  const translations = toTranslationPayload(entry.englishValues);
  if (translations) {
    base.translations = translations;
  }

  const examples = toExamplePayload(entry.examples);
  if (examples) {
    base.examples = examples;
  }

  if (entry.pos === 'N') {
    base.noun = {
      ...(entry.gender ? { gender: entry.gender } : {}),
      ...(entry.plural ? { plural: entry.plural } : {}),
    };
  }

  return base;
}

function withMergedCollections(record: Record<string, unknown>): string[] {
  const existing = Array.isArray(record.collections)
    ? record.collections.filter((value): value is string => typeof value === 'string')
    : [];
  return mergeStringList(existing, [B2_BERUF_COLLECTION]);
}

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const rootDir = path.resolve(path.dirname(__filename), '..');
  const dataDir = path.join(rootDir, 'data');
  const posDir = path.join(dataDir, 'pos');
  const csvPath = path.join(dataDir, 'wortschatz', 'b2-beruf.csv');

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '_');
  const backupDir = path.join(rootDir, 'backups', timestamp);
  const backupPosDir = path.join(backupDir, 'data', 'pos');
  const backupWortschatzDir = path.join(backupDir, 'data', 'wortschatz');
  const auditDir = path.join(backupDir, 'audit');

  await fs.mkdir(backupPosDir, { recursive: true });
  await fs.mkdir(backupWortschatzDir, { recursive: true });
  await fs.mkdir(auditDir, { recursive: true });

  const posFiles = [
    'verbs.jsonl',
    'nouns.jsonl',
    'adjectives.jsonl',
    'adverbs.jsonl',
    'prepositions.jsonl',
    'conjunctions.jsonl',
    'pronouns.jsonl',
    'particles.jsonl',
  ];

  for (const file of posFiles) {
    const source = path.join(posDir, file);
    const target = path.join(backupPosDir, file);
    await fs.copyFile(source, target);
  }
  await fs.copyFile(csvPath, path.join(backupWortschatzDir, 'b2-beruf.csv'));

  const csvOriginal = await fs.readFile(csvPath, 'utf8');
  const rows = normalizeCsvRecords(csvOriginal);

  const rawKeySet = new Set<string>();
  for (const row of rows) {
    const pos = normalizePos(row.posRaw);
    if (!pos) {
      continue;
    }
    const { lemma } = splitLemmaAndPlural(cleanWord(row.word, {
      rowsProcessed: 0,
      wordParenthesesRemoved: 0,
      wordReflexiveNormalized: 0,
      wordMetadataRemoved: 0,
      nounCapitalized: 0,
      englishParenthesesRemoved: 0,
      englishSuffixNormalized: 0,
    }), pos, {
      rowsProcessed: 0,
      wordParenthesesRemoved: 0,
      wordReflexiveNormalized: 0,
      wordMetadataRemoved: 0,
      nounCapitalized: 0,
      englishParenthesesRemoved: 0,
      englishSuffixNormalized: 0,
    });
    if (!lemma) {
      continue;
    }
    rawKeySet.add(createKey(lemma, pos));
  }
  await fs.writeFile(
    path.join(auditDir, 'b2_old_keys_raw.txt'),
    `${Array.from(rawKeySet.values()).sort().join('\n')}\n`,
    'utf8',
  );

  const counters: CleanupCounters = {
    rowsProcessed: 0,
    wordParenthesesRemoved: 0,
    wordReflexiveNormalized: 0,
    wordMetadataRemoved: 0,
    nounCapitalized: 0,
    englishParenthesesRemoved: 0,
    englishSuffixNormalized: 0,
  };

  const cleanedRows: ParsedCsvRow[] = rows.map((row) => {
    counters.rowsProcessed += 1;
    const pos = normalizePos(row.posRaw);
    const cleanedWord = cleanWord(row.word, counters);
    const normalizedWord = pos
      ? splitLemmaAndPlural(cleanedWord, pos, counters).normalizedWord
      : cleanedWord;
    return {
      ...row,
      word: normalizedWord,
      english: cleanEnglish(row.english, counters),
      exampleDe: sanitizeWhitespace(row.exampleDe),
      exampleEn: sanitizeWhitespace(row.exampleEn),
    };
  });

  await fs.writeFile(csvPath, formatCsv(cleanedRows), 'utf8');
  await fs.writeFile(path.join(auditDir, 'cleanup_report.json'), `${JSON.stringify(counters, null, 2)}\n`);

  const b2ByKey = new Map<string, NormalizedB2Entry>();
  const duplicateCount = new Map<string, number>();

  for (const row of cleanedRows) {
    const pos = normalizePos(row.posRaw);
    if (!pos) {
      continue;
    }

    const { lemma, plural } = splitLemmaAndPlural(row.word, pos, counters);
    if (!lemma) {
      continue;
    }

    const english = sanitizeWhitespace(row.english);
    if (!english) {
      continue;
    }

    const key = createKey(lemma, pos);
    const gender = pos === 'N' ? inferGender(row.articlePrefix) : null;
    const example = sanitizeWhitespace(row.exampleDe);
    const exampleEn = sanitizeWhitespace(row.exampleEn);

    const existing = b2ByKey.get(key);
    if (!existing) {
      b2ByKey.set(key, {
        key,
        pos,
        lemma,
        level: 'B2',
        englishPrimary: english,
        englishValues: [english],
        examples: example && exampleEn ? [{ sentence: example, en: exampleEn }] : [],
        gender,
        plural: pos === 'N' ? plural : null,
      });
    } else {
      existing.englishValues = mergeStringList(existing.englishValues, [english]);
      if (example && exampleEn) {
        const merged = mergeStringList(
          existing.examples.map((entry) => `${entry.sentence}::${entry.en}`),
          [`${example}::${exampleEn}`],
        );
        existing.examples = merged.map((entry) => {
          const [sentence, en] = entry.split('::');
          return { sentence: sentence ?? '', en: en ?? '' };
        });
      }
      if (!existing.gender && gender) {
        existing.gender = gender;
      }
      if (!existing.plural && plural) {
        existing.plural = plural;
      }
      duplicateCount.set(key, (duplicateCount.get(key) ?? 1) + 1);
    }
  }

  await fs.writeFile(
    path.join(auditDir, 'duplicate_report.json'),
    `${JSON.stringify(
      {
        duplicateKeyCount: duplicateCount.size,
        duplicates: Array.from(duplicateCount.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, count]) => ({ key, count })),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const posBuckets = new Map<string, Array<Record<string, unknown>>>();
  for (const [pos, filename] of Object.entries(POS_FILENAME_MAP) as Array<[SupportedPos, string]>) {
    const filePath = path.join(posDir, filename);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const records = content
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      posBuckets.set(pos, records);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        posBuckets.set(pos, []);
        continue;
      }
      throw error;
    }
  }

  const overlapReport: Array<Record<string, unknown>> = [];
  const expectedKeys = new Set<string>();
  let inserted = 0;
  let updated = 0;

  for (const entry of b2ByKey.values()) {
    expectedKeys.add(entry.key);
    const bucket = posBuckets.get(entry.pos) ?? [];
    const index = bucket.findIndex(
      (record) =>
        typeof record.lemma === 'string' &&
        createKey(record.lemma, entry.pos) === entry.key,
    );

    if (index === -1) {
      bucket.push(buildRecordFromB2Entry(entry));
      posBuckets.set(entry.pos, bucket);
      inserted += 1;
      continue;
    }

    const existing = bucket[index]!;
    const actions: string[] = [];

    if (existing.level !== 'B2') {
      existing.level = 'B2';
      actions.push('force_level_B2');
    }

    const mergedCollections = withMergedCollections(existing);
    if (JSON.stringify(existing.collections ?? []) !== JSON.stringify(mergedCollections)) {
      existing.collections = mergedCollections;
      actions.push('merge_collections');
    }

    if (!existing.english && entry.englishPrimary) {
      existing.english = entry.englishPrimary;
      actions.push('fill_english');
    }

    const existingTranslations = Array.isArray(existing.translations)
      ? existing.translations.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === 'object'))
      : [];
    const incomingTranslations = toTranslationPayload(entry.englishValues) ?? [];
    const mergedTranslations = mergeStringList(
      existingTranslations
        .map((value) => (typeof value.value === 'string' ? value.value : ''))
        .filter(Boolean),
      incomingTranslations.map((value) => value.value),
    ).map((value) => ({ value, language: 'en', source: 'b2_beruf_csv', confidence: null }));
    if (mergedTranslations.length > 0) {
      existing.translations = mergedTranslations;
      actions.push('merge_translations');
    }

    const existingExamples = normalizeExamplesFromRecord(existing.examples);
    const mergedExampleKeys = mergeStringList(
      existingExamples.map((value) => `${value.sentence}::${value.en}`),
      entry.examples.map((value) => `${value.sentence}::${value.en}`),
    );
    if (mergedExampleKeys.length > 0) {
      existing.examples = mergedExampleKeys.map((value) => {
        const [sentence, en] = value.split('::');
        return {
          sentence: sentence ?? '',
          translations: { en: en ?? '' },
        };
      });
      actions.push('merge_examples');
    }

    if (entry.pos === 'N') {
      const noun = existing.noun && typeof existing.noun === 'object'
        ? (existing.noun as Record<string, unknown>)
        : {};
      if (!noun.gender && entry.gender) {
        noun.gender = entry.gender;
        actions.push('fill_noun_gender');
      }
      if (!noun.plural && entry.plural) {
        noun.plural = entry.plural;
        actions.push('fill_noun_plural');
      }
      existing.noun = noun;
    }

    overlapReport.push({
      key: entry.key,
      existingEnglish: typeof existing.english === 'string' ? existing.english : null,
      incomingEnglish: entry.englishPrimary,
      actions,
    });
    updated += 1;
  }

  for (const [pos, records] of posBuckets.entries()) {
    const filename = POS_FILENAME_MAP[pos as SupportedPos];
    if (!filename) {
      continue;
    }
    sortRecords(records);
    const payload = `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
    await fs.writeFile(path.join(posDir, filename), payload, 'utf8');
  }

  await fs.writeFile(
    path.join(auditDir, 'overlap_report.json'),
    `${JSON.stringify(
      {
        overlapCount: overlapReport.length,
        overlapRows: overlapReport,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const postKeys = new Set<string>();
  for (const [pos, records] of posBuckets.entries()) {
    for (const record of records) {
      const collections = Array.isArray(record.collections)
        ? record.collections.filter((value): value is string => typeof value === 'string')
        : [];
      if (!collections.includes(B2_BERUF_COLLECTION)) {
        continue;
      }
      if (typeof record.lemma !== 'string') {
        continue;
      }
      postKeys.add(createKey(record.lemma, pos as SupportedPos));
    }
  }

  const missing = Array.from(expectedKeys.values()).filter((key) => !postKeys.has(key)).sort();
  const extra = Array.from(postKeys.values()).filter((key) => !expectedKeys.has(key)).sort();

  await fs.writeFile(
    path.join(auditDir, 'parity_report.json'),
    `${JSON.stringify(
      {
        expectedCount: expectedKeys.size,
        postCount: postKeys.size,
        missingCount: missing.length,
        extraCount: extra.length,
        missing,
        extra,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(auditDir, 'b2_old_keys_cleaned.txt'),
    `${Array.from(expectedKeys.values()).sort().join('\n')}\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(auditDir, 'b2_new_keys_from_pos.txt'),
    `${Array.from(postKeys.values()).sort().join('\n')}\n`,
    'utf8',
  );

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `B2 parity mismatch after migration. Missing: ${missing.length}, extra: ${extra.length}. See ${path.relative(rootDir, path.join(auditDir, 'parity_report.json'))}.`,
    );
  }

  console.log(
    JSON.stringify(
      {
        backupDir: path.relative(rootDir, backupDir),
        cleanedRows: counters.rowsProcessed,
        inserted,
        updated,
        overlapCount: overlapReport.length,
        duplicateKeyCount: duplicateCount.size,
        expectedKeyCount: expectedKeys.size,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('Failed to migrate B2 Beruf into POS JSONL', error);
  process.exit(1);
});
