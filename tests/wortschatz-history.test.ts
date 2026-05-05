import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSessionFromRequestMock } from './helpers/mock-auth';
import { setupTestDatabase, type TestDatabaseContext } from './helpers/pg';
import { createApiInvoker } from './helpers/vercel';

describe('Wortschatz history summary API', () => {
  let dbContext: TestDatabaseContext | undefined;
  let invokeApi: ReturnType<typeof createApiInvoker>;

  beforeEach(async () => {
    const context = await setupTestDatabase();
    dbContext = context;
    context.mock();

    getSessionFromRequestMock.mockReset();
    getSessionFromRequestMock.mockResolvedValue(null);

    const { createVercelApiHandler } = await import('../server/api/vercel-handler.js');
    const handler = createVercelApiHandler({ enableCors: false });
    invokeApi = createApiInvoker(handler);
  });

  afterEach(async () => {
    getSessionFromRequestMock.mockReset();
    vi.restoreAllMocks();
    if (dbContext) {
      await dbContext.cleanup();
      dbContext = undefined;
    }
  });

  it('aggregates signed-in Wortschatz attempts from practice_history', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    getSessionFromRequestMock.mockResolvedValue({
      session: { id: 'session-wortschatz', expiresAt: new Date().toISOString() },
      user: { id: 'user-123', role: 'standard' },
    } as any);

    const wordResult = await dbContext.pool.query(
      [
        'insert into words (lemma, pos, level, english, approved, complete, sources_csv)',
        'values ($1, $2, $3, $4, true, true, $5)',
        'returning id',
      ].join(' '),
      ['Arbeitsvertrag', 'N', 'B2', 'employment contract', null],
    );
    const wordId = wordResult.rows[0]!.id;

    await dbContext.pool.query(
      [
        'insert into words (lemma, pos, level, english, approved, complete, sources_csv)',
        'values ($1, $2, $3, $4, true, true, $5)',
      ].join(' '),
      ['Projekt', 'N', 'B2', 'project', null],
    );

    await dbContext.pool.query(
      [
        'insert into lexemes (id, lemma, language, pos, metadata)',
        "values ('lex-1', 'Arbeitsvertrag', 'de', 'noun', '{\"collections\":[\"b2_beruf\"]}'::jsonb),",
        "('lex-2', 'Projekt', 'de', 'noun', '{\"collections\":[]}'::jsonb)",
      ].join(' '),
    );

    await dbContext.pool.query(
      [
        "insert into task_specs (id, lexeme_id, pos, task_type, renderer, prompt, solution)",
        "values ('task-1', 'lex-1', 'noun', 'vocabulary_drill', 'word_card', '{}', '{}'),",
        "('task-3', 'lex-2', 'noun', 'vocabulary_drill', 'word_card', '{}', '{}')",
      ].join(" "),
    );

    await dbContext.pool.query(
      [
        'insert into practice_history',
        '(user_id, task_id, lexeme_id, lemma, pos, task_type, renderer, device_id, result, submitted_answer, correct_answer, response_ms, submitted_at)',
        'values',
        "('user-123', 'task-1', 'lex-1', 'Arbeitsvertrag', 'noun', 'vocabulary_drill', 'word_card', 'device-1', 'correct', 'known', 'known', 700, now()),",
        "('user-123', 'task-1', 'lex-1', 'Arbeitsvertrag', 'noun', 'vocabulary_drill', 'word_card', 'device-1', 'incorrect', 'missed', 'known', 800, now()),",
        "('user-123', 'task-3', 'lex-2', 'Projekt', 'noun', 'vocabulary_drill', 'word_card', 'device-1', 'correct', 'known', 'known', 900, now()),",
        "('other-user', 'task-1', 'lex-1', 'Arbeitsvertrag', 'noun', 'vocabulary_drill', 'word_card', 'device-2', 'correct', 'known', 'known', 900, now())",
      ].join(' '),
    );

    const response = await invokeApi('/api/wortschatz/history-summary');

    expect(response.status).toBe(200);
    expect(response.bodyJson).toMatchObject({
      totalAttempts: 2,
      correctAttempts: 1,
      incorrectAttempts: 1,
      practicedWordIds: [wordId],
      correctWordIds: [wordId],
      byWordId: {
        [String(wordId)]: {
          attempts: 2,
          correct: 1,
          incorrect: 1,
        },
      },
    });
  });

  it('aggregates signed-in Android Wortschatz attempts with normalized POS codes', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    getSessionFromRequestMock.mockResolvedValue({
      session: { id: 'session-wortschatz-android-pos', expiresAt: new Date().toISOString() },
      user: { id: 'user-android-pos', role: 'standard' },
    } as any);

    const wordResult = await dbContext.pool.query(
      [
        'insert into words (lemma, pos, level, english, approved, complete, sources_csv)',
        'values ($1, $2, $3, $4, true, true, $5)',
        'returning id',
      ].join(' '),
      ['Arbeitsvertrag', 'N', 'B2', 'employment contract', null],
    );
    const wordId = wordResult.rows[0]!.id;

    await dbContext.pool.query(
      [
        'insert into lexemes (id, lemma, language, pos, metadata)',
        "values ('lex-android-1', 'Arbeitsvertrag', 'de', 'noun', '{\"collections\":[\"b2_beruf\"]}'::jsonb)",
      ].join(' '),
    );

    await dbContext.pool.query(
      [
        "insert into task_specs (id, lexeme_id, pos, task_type, renderer, prompt, solution)",
        "values ('task-android-1', 'lex-android-1', 'noun', 'vocabulary_drill', 'word_card', '{}', '{}')",
      ].join(" "),
    );

    await dbContext.pool.query(
      [
        'insert into practice_history',
        '(user_id, task_id, lexeme_id, lemma, pos, task_type, renderer, device_id, result, submitted_answer, correct_answer, response_ms, submitted_at)',
        'values',
        "('user-android-pos', 'task-android-1', 'lex-android-1', 'Arbeitsvertrag', 'noun', 'vocabulary_drill', 'word_card', 'device-android', 'correct', 'Arbeitsvertrag', 'Arbeitsvertrag', 700, now()),",
        "('user-android-pos', 'task-android-1', 'lex-android-1', 'Arbeitsvertrag', 'noun', 'vocabulary_drill', 'word_card', 'device-android', 'incorrect', '', 'Arbeitsvertrag', 800, now())",
      ].join(' '),
    );

    const response = await invokeApi('/api/wortschatz/history-summary');

    expect(response.status).toBe(200);
    expect(response.bodyJson).toMatchObject({
      totalAttempts: 2,
      correctAttempts: 1,
      incorrectAttempts: 1,
      practicedWordIds: [wordId],
      correctWordIds: [wordId],
      byWordId: {
        [String(wordId)]: {
          attempts: 2,
          correct: 1,
          incorrect: 1,
        },
      },
    });
  });
});
