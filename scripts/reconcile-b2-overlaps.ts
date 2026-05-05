import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type SupportedPos = 'V' | 'N' | 'Adj' | 'Adv' | 'Praep' | 'Konj' | 'Pron' | 'Part';

interface OverlapRow {
  key: string;
  existingEnglish: string | null;
  incomingEnglish: string | null;
  actions?: string[];
}

interface OverlapReport {
  overlapCount: number;
  overlapRows: OverlapRow[];
}

interface DecisionRow {
  key: string;
  decision: 'redundant' | 'added_translation' | 'skipped_manual';
  existingEnglish: string | null;
  incomingEnglish: string | null;
  reason: string;
}

const POS_FILENAME_MAP: Record<SupportedPos, string> = {
  V: 'verbs.jsonl',
  N: 'nouns.jsonl',
  Adj: 'adjectives.jsonl',
  Adv: 'adverbs.jsonl',
  Praep: 'prepositions.jsonl',
  Konj: 'conjunctions.jsonl',
  Pron: 'pronouns.jsonl',
  Part: 'particles.jsonl',
};

function sanitizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function splitEnglishVariants(value: string): string[] {
  const normalized = sanitizeWhitespace(value);
  if (!normalized) {
    return [];
  }

  const rough = normalized
    .replace(/\bor\b/gi, ',')
    .replace(/[;/]|\s\|\s/g, ',')
    .split(',')
    .map((entry) => sanitizeWhitespace(entry))
    .filter(Boolean);

  return rough.length > 0 ? rough : [normalized];
}

function singularizeWord(word: string): string {
  if (word.length <= 3) {
    return word;
  }
  if (/(ss|us|is)$/.test(word)) {
    return word;
  }
  if (word.endsWith('ies') && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }
  if (word.endsWith('es') && word.length > 4) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s')) {
    return word.slice(0, -1);
  }
  return word;
}

function normalizeForCompare(value: string): string {
  const cleaned = sanitizeWhitespace(value)
    .toLowerCase()
    .replace(/^\(to\)\s+/i, 'to ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\b(an|a|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned
    .split(' ')
    .map((token) => singularizeWord(token.trim()))
    .filter(Boolean);

  return tokens.join(' ');
}

function isEquivalent(existing: string, incoming: string): boolean {
  const incomingNorm = normalizeForCompare(incoming);
  if (!incomingNorm) {
    return true;
  }

  const existingVariants = splitEnglishVariants(existing);
  for (const variant of existingVariants) {
    const variantNorm = normalizeForCompare(variant);
    if (variantNorm === incomingNorm) {
      return true;
    }
  }

  const existingNorm = normalizeForCompare(existing);
  return existingNorm === incomingNorm;
}

function parseKey(key: string): { lemma: string; pos: SupportedPos } | null {
  const splitIndex = key.lastIndexOf('::');
  if (splitIndex === -1) {
    return null;
  }
  const lemma = key.slice(0, splitIndex).trim();
  const rawPos = key.slice(splitIndex + 2).trim();
  const posRaw = (rawPos === 'Präp' ? 'Praep' : rawPos) as SupportedPos;
  if (!lemma || !(posRaw in POS_FILENAME_MAP)) {
    return null;
  }
  return { lemma, pos: posRaw };
}

function hasSuspiciousIncoming(pos: SupportedPos, incoming: string): string | null {
  const trimmed = sanitizeWhitespace(incoming);
  if (!trimmed) {
    return 'empty incoming english';
  }

  if (pos === 'Adj' && /\bly\b/i.test(trimmed)) {
    return 'adjective overlap with likely adverb gloss';
  }

  return null;
}

async function readJsonlRecords(filePath: string): Promise<Array<Record<string, unknown>>> {
  const content = await fs.readFile(filePath, 'utf8');
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function sortRecords(records: Array<Record<string, unknown>>): void {
  records.sort((a, b) => {
    const lemmaA = typeof a.lemma === 'string' ? a.lemma : '';
    const lemmaB = typeof b.lemma === 'string' ? b.lemma : '';
    const byLemma = lemmaA.localeCompare(lemmaB, 'de-DE');
    if (byLemma !== 0) {
      return byLemma;
    }
    return JSON.stringify(a).localeCompare(JSON.stringify(b), 'en-US');
  });
}

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const rootDir = path.resolve(path.dirname(__filename), '..');

  const backupsDir = path.join(rootDir, 'backups');
  const backupEntries = await fs.readdir(backupsDir, { withFileTypes: true });
  const backupNames = backupEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (backupNames.length === 0) {
    throw new Error('No backups found; cannot resolve overlaps.');
  }

  const latestBackup = backupNames[backupNames.length - 1]!;
  const auditDir = path.join(backupsDir, latestBackup, 'audit');
  const overlapReportPath = path.join(auditDir, 'overlap_report.json');
  const overlapRaw = await fs.readFile(overlapReportPath, 'utf8');
  const overlapReport = JSON.parse(overlapRaw) as OverlapReport;

  const posDir = path.join(rootDir, 'data', 'pos');
  const posRecords = new Map<SupportedPos, Array<Record<string, unknown>>>();
  for (const [pos, filename] of Object.entries(POS_FILENAME_MAP) as Array<[SupportedPos, string]>) {
    const filePath = path.join(posDir, filename);
    const records = await readJsonlRecords(filePath);
    posRecords.set(pos, records);
  }

  const decisions: DecisionRow[] = [];
  let addedTranslationCount = 0;

  for (const row of overlapReport.overlapRows) {
    const parsed = parseKey(row.key);
    if (!parsed) {
      decisions.push({
        key: row.key,
        decision: 'skipped_manual',
        existingEnglish: row.existingEnglish,
        incomingEnglish: row.incomingEnglish,
        reason: 'invalid key format',
      });
      continue;
    }

    const incomingEnglish = typeof row.incomingEnglish === 'string' ? sanitizeWhitespace(row.incomingEnglish) : '';
    if (!incomingEnglish) {
      decisions.push({
        key: row.key,
        decision: 'redundant',
        existingEnglish: row.existingEnglish,
        incomingEnglish: row.incomingEnglish,
        reason: 'missing incoming english',
      });
      continue;
    }

    const suspicious = hasSuspiciousIncoming(parsed.pos, incomingEnglish);
    if (suspicious) {
      decisions.push({
        key: row.key,
        decision: 'skipped_manual',
        existingEnglish: row.existingEnglish,
        incomingEnglish: row.incomingEnglish,
        reason: suspicious,
      });
      continue;
    }

    const bucket = posRecords.get(parsed.pos) ?? [];
    const record = bucket.find(
      (entry) => typeof entry.lemma === 'string' && entry.lemma.toLowerCase() === parsed.lemma.toLowerCase(),
    );

    if (!record) {
      decisions.push({
        key: row.key,
        decision: 'skipped_manual',
        existingEnglish: row.existingEnglish,
        incomingEnglish: row.incomingEnglish,
        reason: 'record not found in current POS file',
      });
      continue;
    }

    const existingEnglish = typeof record.english === 'string' ? sanitizeWhitespace(record.english) : '';
    if (existingEnglish && isEquivalent(existingEnglish, incomingEnglish)) {
      decisions.push({
        key: row.key,
        decision: 'redundant',
        existingEnglish: row.existingEnglish,
        incomingEnglish: row.incomingEnglish,
        reason: 'incoming gloss equivalent to existing english',
      });
      continue;
    }

    const existingTranslations = Array.isArray(record.translations)
      ? record.translations.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
      : [];

    const hasEquivalentTranslation = existingTranslations.some((entry) => {
      const value = typeof entry.value === 'string' ? sanitizeWhitespace(entry.value) : '';
      return value ? isEquivalent(value, incomingEnglish) : false;
    });

    if (hasEquivalentTranslation) {
      decisions.push({
        key: row.key,
        decision: 'redundant',
        existingEnglish: row.existingEnglish,
        incomingEnglish: row.incomingEnglish,
        reason: 'incoming gloss already present in translations',
      });
      continue;
    }

    record.translations = [
      ...existingTranslations,
      {
        value: incomingEnglish,
        language: 'en',
        source: 'b2_beruf_overlap',
        confidence: null,
      },
    ];

    decisions.push({
      key: row.key,
      decision: 'added_translation',
      existingEnglish: row.existingEnglish,
      incomingEnglish: row.incomingEnglish,
      reason: 'preserved non-equivalent incoming overlap gloss as alternate translation',
    });
    addedTranslationCount += 1;
  }

  for (const [pos, records] of posRecords.entries()) {
    sortRecords(records);
    const filename = POS_FILENAME_MAP[pos];
    const payload = `${records.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
    await fs.writeFile(path.join(posDir, filename), payload, 'utf8');
  }

  const manual = decisions.filter((entry) => entry.decision === 'skipped_manual');
  const summary = {
    backupUsed: latestBackup,
    overlapCount: overlapReport.overlapCount,
    addedTranslationCount,
    redundantCount: decisions.filter((entry) => entry.decision === 'redundant').length,
    manualReviewCount: manual.length,
  };

  await fs.writeFile(
    path.join(auditDir, 'overlap_resolution_decisions.json'),
    `${JSON.stringify({ summary, decisions }, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(auditDir, 'overlap_manual_review.json'),
    `${JSON.stringify({ summary, manual }, null, 2)}\n`,
    'utf8',
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('Failed to reconcile B2 overlap report', error);
  process.exit(1);
});
