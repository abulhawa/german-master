import { Router } from 'express';
import { asc, count, eq, like, or, sql } from 'drizzle-orm';

import { db, lexemes, practiceHistory, userPracticeHistory, words } from '@db';
import type { PartOfSpeech, WortschatzWord } from '@shared';
import { ANDROID_B2_BERUF_SOURCE, ANDROID_B2_BERUF_VERSION } from '@shared/content-sources';
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

function createDelimitedSourceFilter(source: string) {
  return or(
    sql`coalesce(${words.sourcesCsv}, '') = ${source}`,
    like(words.sourcesCsv, `${source};%`),
    like(words.sourcesCsv, `%;${source}`),
    like(words.sourcesCsv, `%;${source};%`),
  );
}

function mapHistoryPosToWordPosSql(column: typeof userPracticeHistory.pos | typeof lexemes.pos) {
  return sql`case lower(${column})
    when 'v' then 'V'
    when 'verb' then 'V'
    when 'n' then 'N'
    when 'noun' then 'N'
    when 'adj' then 'Adj'
    when 'adjective' then 'Adj'
    when 'adv' then 'Adv'
    when 'adverb' then 'Adv'
    when 'pron' then 'Pron'
    when 'pronoun' then 'Pron'
    when 'det' then 'Det'
    when 'determiner' then 'Det'
    when 'art' then 'Det'
    when 'prep' then 'Pr\u00e4p'
    when 'pr\u00e4p' then 'Pr\u00e4p'
    when 'pr\u00e3\u00a4p' then 'Pr\u00e4p'
    when 'pr\u00e3\u0192\u00e2\u00a4p' then 'Pr\u00e4p'
    when 'praep' then 'Pr\u00e4p'
    when 'preposition' then 'Pr\u00e4p'
    when 'konj' then 'Konj'
    when 'conj' then 'Konj'
    when 'conjunction' then 'Konj'
    when 'num' then 'Num'
    when 'numeral' then 'Num'
    when 'part' then 'Part'
    when 'particle' then 'Part'
    when 'int' then 'Interj'
    when 'interj' then 'Interj'
    when 'interjection' then 'Interj'
    else '' end`;
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
        })
        .from(words)
        .where(createDelimitedSourceFilter(ANDROID_B2_BERUF_SOURCE))
        .orderBy(sql`lower(${words.lemma})`, asc(words.id));

      const payload: WortschatzWord[] = rows.map((row) => ({
        ...row,
        pos: row.pos as PartOfSpeech,
      }));

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Wortschatz-Dataset-Version', ANDROID_B2_BERUF_VERSION);
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
      const sourceFilter = createDelimitedSourceFilter(ANDROID_B2_BERUF_SOURCE);
      const rows = sessionUserId
        ? await db
            .select({
              wordId: words.id,
              result: userPracticeHistory.result,
              count: count(),
            })
            .from(userPracticeHistory)
            .innerJoin(
              words,
              sql`lower(${words.lemma}) = lower(${userPracticeHistory.lemma})
                AND ${words.pos} = ${mapHistoryPosToWordPosSql(userPracticeHistory.pos)}`,
            )
            .where(sql`${userPracticeHistory.userId} = ${sessionUserId} AND ${sourceFilter}`)
            .groupBy(words.id, userPracticeHistory.result)
        : await db
            .select({
              wordId: words.id,
              result: practiceHistory.result,
              count: count(),
            })
            .from(practiceHistory)
            .innerJoin(lexemes, eq(practiceHistory.lexemeId, lexemes.id))
            .innerJoin(
              words,
              sql`lower(${words.lemma}) = lower(${lexemes.lemma})
                AND ${words.pos} = ${mapHistoryPosToWordPosSql(lexemes.pos)}`,
            )
            .where(sql`${practiceHistory.deviceId} = ${deviceId} AND ${sourceFilter}`)
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
