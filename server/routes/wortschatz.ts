import { createHash } from 'node:crypto';

import { Router } from 'express';
import { asc, count, eq, sql } from 'drizzle-orm';

import { db, lexemes, practiceHistory, words } from '@db';
import type { PartOfSpeech, WortschatzWord } from '@shared';
import { B2_BERUF_COLLECTION } from '@shared/content-sources';
import { getSessionUserId, sendError } from './shared.js';

interface WortschatzHistorySummaryRow {
  wordId: number;
  result: 'correct' | 'incorrect';
  count: number | string | bigint;
}

interface WortschatzWordHistorySummary {
  attempts: number;
  correct: number;
  incorrect: number;
}

interface WortschatzHistorySummary {
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  practicedWordIds: number[];
  correctWordIds: number[];
  byWordId: Record<string, WortschatzWordHistorySummary>;
}

let cachedDatasetVersion: { signature: string; version: string } | null = null;

function collectionFilterOnLexemeMetadata(metadataColumn: unknown) {
  const collectionJson = JSON.stringify([B2_BERUF_COLLECTION]);
  return sql`coalesce(${metadataColumn} -> 'collections', '[]'::jsonb) @> ${collectionJson}::jsonb`;
}

function toCount(value: number | string | bigint): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildHistorySummary(rows: WortschatzHistorySummaryRow[]): WortschatzHistorySummary {
  const byWordId: Record<string, WortschatzWordHistorySummary> = {};

  for (const row of rows) {
    const key = String(row.wordId);
    const existing = byWordId[key] ?? { attempts: 0, correct: 0, incorrect: 0 };
    const rowCount = toCount(row.count);

    existing.attempts += rowCount;
    if (row.result === 'correct') {
      existing.correct += rowCount;
    } else {
      existing.incorrect += rowCount;
    }

    byWordId[key] = existing;
  }

  const practicedWordIds = Object.entries(byWordId)
    .filter(([, summary]) => summary.attempts > 0)
    .map(([wordId]) => Number(wordId))
    .filter((wordId) => Number.isInteger(wordId));
  const correctWordIds = Object.entries(byWordId)
    .filter(([, summary]) => summary.correct > 0)
    .map(([wordId]) => Number(wordId))
    .filter((wordId) => Number.isInteger(wordId));
  const totals = Object.values(byWordId).reduce(
    (acc, summary) => ({
      totalAttempts: acc.totalAttempts + summary.attempts,
      correctAttempts: acc.correctAttempts + summary.correct,
      incorrectAttempts: acc.incorrectAttempts + summary.incorrect,
    }),
    { totalAttempts: 0, correctAttempts: 0, incorrectAttempts: 0 },
  );

  return {
    ...totals,
    practicedWordIds,
    correctWordIds,
    byWordId,
  };
}

function computeDatasetVersion(
  rows: Array<{
    id: number;
    lemma: string;
    pos: string;
    level: string | null;
    english: string | null;
    exampleDe: string | null;
    exampleEn: string | null;
    gender: string | null;
    plural: string | null;
    updatedAt: Date;
  }>,
): string {
  const signature = rows
    .map((row) => `${row.id}:${row.updatedAt.toISOString()}`)
    .join('|');

  if (cachedDatasetVersion?.signature === signature) {
    return cachedDatasetVersion.version;
  }

  const payload = JSON.stringify(
    rows.map((row) => ({
      id: row.id,
      lemma: row.lemma,
      pos: row.pos,
      level: row.level,
      english: row.english,
      exampleDe: row.exampleDe,
      exampleEn: row.exampleEn,
      gender: row.gender,
      plural: row.plural,
    })),
  );
  const version = createHash('sha1').update(payload).digest('hex');
  cachedDatasetVersion = { signature, version };
  return version;
}

export function createWortschatzRouter(): Router {
  const router = Router();

  router.get('/wortschatz/words', async (_req, res) => {
    try {
      const rows = await db
        .select({
          id: words.id,
          lemma: words.lemma,
          pos: words.pos,
          level: words.level,
          english: words.english,
          exampleDe: words.exampleDe,
          exampleEn: words.exampleEn,
          gender: words.gender,
          plural: words.plural,
          updatedAt: words.updatedAt,
        })
        .from(words)
        .innerJoin(
          lexemes,
          sql`lower(${words.lemma}) = lower(${lexemes.lemma})
            AND ${lexemes.pos} = ${words.pos}`,
        )
        .where(collectionFilterOnLexemeMetadata(lexemes.metadata))
        .orderBy(sql`lower(${words.lemma})`, asc(words.id));

      const payload: WortschatzWord[] = rows.map((row) => ({
        id: row.id,
        lemma: row.lemma,
        pos: row.pos as PartOfSpeech,
        level: row.level,
        english: row.english,
        exampleDe: row.exampleDe,
        exampleEn: row.exampleEn,
        gender: row.gender,
        plural: row.plural,
      }));

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Wortschatz-Dataset-Version', computeDatasetVersion(rows));
      res.json(payload);
    } catch (error) {
      console.error('Failed to load Wortschatz words', error);
      res.status(500).json({
        error: 'Failed to load Wortschatz words',
        code: 'WORTSCHATZ_WORDS_FAILED',
      });
    }
  });

  router.get('/wortschatz/history-summary', async (req, res) => {
    const sessionUserId = getSessionUserId(req.authSession);
    const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId.trim() : null;

    if (!sessionUserId && !deviceId) {
      return sendError(res, 400, 'Device identifier required', 'DEVICE_ID_REQUIRED');
    }

    try {
      const identityFilter = sessionUserId
        ? eq(practiceHistory.userId, sessionUserId)
        : eq(practiceHistory.deviceId, deviceId!);

      const rows = await db
        .select({
          wordId: words.id,
          result: practiceHistory.result,
          count: count(),
        })
        .from(practiceHistory)
        .innerJoin(lexemes, eq(practiceHistory.lexemeId, lexemes.id))
        .innerJoin(
          words,
          sql`lower(${words.lemma}) = lower(coalesce(${practiceHistory.lemma}, ${lexemes.lemma}))
            AND ${words.pos} = ${practiceHistory.pos}`,
        )
        .where(
          sql`${identityFilter} AND ${collectionFilterOnLexemeMetadata(lexemes.metadata)}`,
        )
        .groupBy(words.id, practiceHistory.result);

      res.setHeader('Cache-Control', 'no-store');
      res.json(buildHistorySummary(rows as WortschatzHistorySummaryRow[]));
    } catch (error) {
      console.error('Failed to load Wortschatz history summary', error);
      res.status(500).json({
        error: 'Failed to load Wortschatz history summary',
        code: 'WORTSCHATZ_HISTORY_SUMMARY_FAILED',
      });
    }
  });

  return router;
}
