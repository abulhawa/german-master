import { getSessionFromRequestMock } from './helpers/mock-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AggregatedWord } from '../scripts/etl/types';
import { ANDROID_B2_BERUF_SOURCE, B2_BERUF_COLLECTION } from '../shared/content-sources';
import { setupTestDatabase, type TestDatabaseContext } from './helpers/pg';
import { createApiInvoker } from './helpers/vercel';

describe('tasks API', () => {
  let seedLexemeInventoryForWords: typeof import('./helpers/task-fixtures').seedLexemeInventoryForWords;
  let ensureTaskSpecsSynced: typeof import('../server/tasks/synchronizer.js').ensureTaskSpecsSynced;
  let resetTaskSpecSync: typeof import('../server/tasks/synchronizer.js').resetTaskSpecSync;
  let resetTaskSpecCache: typeof import('../server/cache/task-specs-cache.js').resetTaskSpecCache;
  let setTaskSpecCacheTtlMs: typeof import('../server/cache/task-specs-cache.js').setTaskSpecCacheTtlMs;
  let invokeApi: ReturnType<typeof createApiInvoker>;
  let createVercelApiHandler: typeof import('../server/api/vercel-handler.js').createVercelApiHandler;
  let practiceHistoryTable: typeof import('../db/schema.js').practiceHistory;
  let drizzleDb: typeof import('@db').db;
  let dbContext: TestDatabaseContext | undefined;
  beforeEach(async () => {
    const context = await setupTestDatabase();
    dbContext = context;
    context.mock();

    getSessionFromRequestMock.mockReset();
    getSessionFromRequestMock.mockResolvedValue(null);

    const schemaModule = await import('../db/schema.js');
    practiceHistoryTable = schemaModule.practiceHistory;
    const dbModule = await import('@db');
    drizzleDb = dbModule.db;

  const sampleWords: AggregatedWord[] = [
    {
      lemma: 'gehen',
      pos: 'V',
      level: 'A1',
        english: 'to go',
        exampleDe: 'Wir gehen nach Hause.',
        exampleEn: 'We go home.',
        gender: null,
        plural: null,
        separable: false,
        aux: 'sein',
        praesensIch: 'gehe',
        praesensEr: 'geht',
        praeteritum: 'ging',
        partizipIi: 'gegangen',
        perfekt: 'ist gegangen',
        comparative: null,
        superlative: null,
        approved: true,
        complete: true,
      },
      {
        lemma: 'kommen',
        pos: 'V',
        level: 'A1',
        english: 'to come',
        exampleDe: 'Sie kommen später.',
        exampleEn: 'They come later.',
        gender: null,
        plural: null,
        separable: false,
        aux: 'sein',
        praesensIch: 'komme',
        praesensEr: 'kommt',
        praeteritum: 'kam',
        partizipIi: 'gekommen',
        perfekt: 'ist gekommen',
        comparative: null,
      superlative: null,
      approved: true,
      complete: true,
      translations: null,
      examples: null,
      posAttributes: null,
      enrichmentAppliedAt: null,
      enrichmentMethod: null,
    },
    {
      lemma: 'Haus',
      pos: 'N',
        level: 'A1',
        english: 'house',
        exampleDe: 'Das Haus ist groß.',
        exampleEn: 'The house is big.',
        gender: 'das',
        plural: 'Häuser',
        separable: null,
        aux: null,
        praesensIch: null,
        praesensEr: null,
        praeteritum: null,
        partizipIi: null,
        perfekt: null,
        comparative: null,
      superlative: null,
      approved: true,
      complete: true,
      translations: null,
      examples: null,
      posAttributes: null,
      enrichmentAppliedAt: null,
      enrichmentMethod: null,
    },
    {
      lemma: 'schnell',
      pos: 'Adj',
        level: 'A1',
        english: 'fast',
        exampleDe: 'Ein schneller Zug.',
        exampleEn: 'A fast train.',
        gender: null,
        plural: null,
        separable: null,
        aux: null,
        praesensIch: null,
        praesensEr: null,
        praeteritum: null,
        partizipIi: null,
        perfekt: null,
        comparative: 'schneller',
      superlative: 'am schnellsten',
      approved: true,
      complete: true,
      translations: null,
      examples: null,
      posAttributes: null,
      enrichmentAppliedAt: null,
      enrichmentMethod: null,
    },
    {
      lemma: 'Projekt',
      pos: 'N',
      level: 'B2',
      english: 'project',
      exampleDe: 'Das Projekt braucht einen klaren Zeitplan.',
      exampleEn: 'The project needs a clear timeline.',
      gender: 'das',
      plural: 'Projekte',
      separable: null,
      aux: null,
      praesensIch: null,
      praesensEr: null,
      praeteritum: null,
      partizipIi: null,
      perfekt: null,
      comparative: null,
      superlative: null,
      approved: true,
      complete: true,
      translations: null,
      examples: null,
      posAttributes: null,
      enrichmentAppliedAt: null,
      enrichmentMethod: null,
    },
    {
      lemma: 'Arbeitsvertrag',
      pos: 'N',
      level: 'B2 Beruf',
      english: 'employment contract',
      exampleDe: 'Der Arbeitsvertrag regelt die Probezeit.',
      exampleEn: 'The employment contract defines the probation period.',
      gender: 'der',
      plural: 'Arbeitsvertraege',
      separable: null,
      aux: null,
      praesensIch: null,
      praesensEr: null,
      praeteritum: null,
      partizipIi: null,
      perfekt: null,
      comparative: null,
      superlative: null,
      approved: true,
      complete: true,
      translations: null,
      examples: null,
      posAttributes: null,
      enrichmentAppliedAt: null,
      enrichmentMethod: null,
      sourcesCsv: ANDROID_B2_BERUF_SOURCE,
    },
  ];

    ({ seedLexemeInventoryForWords } = await import('./helpers/task-fixtures'));
    ({ ensureTaskSpecsSynced, resetTaskSpecSync } = await import('../server/tasks/synchronizer.js'));
    ({ resetTaskSpecCache, setTaskSpecCacheTtlMs } = await import('../server/cache/task-specs-cache.js'));

    await seedLexemeInventoryForWords(drizzleDb, sampleWords);
    resetTaskSpecSync();
    resetTaskSpecCache();
    setTaskSpecCacheTtlMs(null);
    await ensureTaskSpecsSynced();

    ({ createVercelApiHandler } = await import('../server/api/vercel-handler.js'));
    const handler = createVercelApiHandler({ enableCors: false });
    invokeApi = createApiInvoker(handler);
  });

  afterEach(async () => {
    getSessionFromRequestMock.mockReset();
    if (resetTaskSpecCache) {
      resetTaskSpecCache();
    }
    if (setTaskSpecCacheTtlMs) {
      setTaskSpecCacheTtlMs(null);
    }
    if (dbContext) {
      await dbContext.cleanup();
      dbContext = undefined;
    }
  });

  async function fetchFirstVocabularyTask(query = ''): Promise<any> {
    const separator = query ? `&${query}` : '';
    const response = await invokeApi(`/api/tasks?taskTypes=vocabulary_drill&limit=10${separator}`);
    expect(response.status).toBe(200);
    const task = ((response.bodyJson as any).tasks ?? [])[0];
    expect(task).toBeDefined();
    expect(task.taskType).toBe('vocabulary_drill');
    return task;
  }

  async function insertLegacyWordForLemma(lemma: string): Promise<string> {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    const insertedWord = await dbContext.pool.query<{ id: number }>(
      [
        'insert into words',
        '(lemma, pos, level, english, gender, plural, approved, complete, sources_csv)',
        'values ($1, $2, $3, $4, $5, $6, true, true, $7)',
        'returning id',
      ].join(' '),
      [
        lemma,
        'N',
        'B2 Beruf',
        'employment contract',
        'der',
        'Arbeitsvertraege',
        ANDROID_B2_BERUF_SOURCE,
      ],
    );
    return `word_${insertedWord.rows[0]!.id}`;
  }

  it('prunes tasks with unsupported types before serving requests', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    const taskLookup = await dbContext.pool.query(
      'select id from task_specs order by updated_at desc limit 1',
    );
    const taskId = taskLookup.rows[0]?.id;
    expect(taskId).toBeDefined();

    await dbContext.pool.query(
      'update task_specs set task_type = $1 where id = $2',
      ['unsupported_task_type', taskId],
    );

    const response = await invokeApi('/api/tasks');
    expect(response.status).toBe(200);

    const staleCount = await dbContext.pool.query(
      'select count(*)::int as count from task_specs where task_type = $1',
      ['unsupported_task_type'],
    );
    expect(staleCount.rows[0]?.count).toBe(0);
  });

  it('returns grouped tasks when requesting multiple task types', async () => {
    const response = await invokeApi(
      '/api/tasks?taskTypes=conjugate_form&taskTypes=noun_case_declension&limit=2',
    );

    expect(response.status).toBe(200);
    const body = response.bodyJson as any;
    expect(body.tasksByType).toBeDefined();
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(body.tasksByType.conjugate_form?.length).toBeGreaterThan(0);
    expect(body.tasksByType.noun_case_declension?.length).toBeGreaterThan(0);
    const taskTypes = new Set(body.tasks.map((task: any) => task.taskType));
    expect(taskTypes.has('conjugate_form')).toBe(true);
    expect(taskTypes.has('noun_case_declension')).toBe(true);
  });

  it('enforces a multi-level allowlist across multiple task types', async () => {
    const response = await invokeApi(
      '/api/tasks?taskTypes=conjugate_form&taskTypes=noun_case_declension&level=B1&level=B2&limit=10',
    );

    expect(response.status).toBe(200);
    const body = response.bodyJson as any;
    const tasks = Array.isArray(body.tasks) ? body.tasks : [];
    expect(tasks.length).toBeGreaterThan(0);

    for (const task of tasks) {
      const lexemeLevel = typeof task?.lexeme?.metadata?.level === 'string'
        ? String(task.lexeme.metadata.level).toUpperCase()
        : null;
      const promptLevel = typeof task?.prompt?.cefrLevel === 'string'
        ? String(task.prompt.cefrLevel).toUpperCase()
        : null;
      const resolvedLevel = lexemeLevel ?? promptLevel;
      expect(resolvedLevel).not.toBeNull();
      expect(['B1', 'B2']).toContain(resolvedLevel);
    }
  });

  it('filters vocabulary drill tasks by B2 Beruf collection separately from level', async () => {
    const collectionOnlyResponse = await invokeApi(
      `/api/tasks?taskTypes=vocabulary_drill&collection=${B2_BERUF_COLLECTION}&limit=10`,
    );
    expect(collectionOnlyResponse.status).toBe(200);
    const collectionOnlyTasks = ((collectionOnlyResponse.bodyJson as any).tasks ?? []) as any[];
    expect(collectionOnlyTasks.length).toBeGreaterThan(0);
    expect(collectionOnlyTasks.some((task) => task.lexeme?.lemma === 'Arbeitsvertrag')).toBe(true);
    expect(collectionOnlyTasks.every((task) => task.lexeme?.lemma !== 'Projekt')).toBe(true);

    const berufResponse = await invokeApi(
      `/api/tasks?taskTypes=vocabulary_drill&level=B2&collection=${B2_BERUF_COLLECTION}&limit=10`,
    );
    expect(berufResponse.status).toBe(200);

    const berufTasks = ((berufResponse.bodyJson as any).tasks ?? []) as any[];
    expect(berufTasks.length).toBeGreaterThan(0);
    expect(berufTasks.every((task) => task.taskType === 'vocabulary_drill')).toBe(true);
    expect(berufTasks.some((task) => task.lexeme?.lemma === 'Arbeitsvertrag')).toBe(true);
    for (const task of berufTasks) {
      expect(task.prompt?.cefrLevel).toBe('B2');
      expect(task.prompt?.collections).toContain(B2_BERUF_COLLECTION);
      expect(task.lexeme?.metadata?.level).toBe('B2');
      expect(task.lexeme?.metadata?.collections).toContain(B2_BERUF_COLLECTION);
    }

    const allB2Response = await invokeApi('/api/tasks?taskTypes=vocabulary_drill&level=B2&limit=10');
    expect(allB2Response.status).toBe(200);
    const allB2Lemmas = (((allB2Response.bodyJson as any).tasks ?? []) as any[]).map(
      (task) => task.lexeme?.lemma,
    );
    expect(allB2Lemmas).toContain('Arbeitsvertrag');
    expect(allB2Lemmas).toContain('Projekt');

    const legacyLevelResponse = await invokeApi(
      `/api/tasks?taskTypes=vocabulary_drill&level=${encodeURIComponent('B2 Beruf')}&collection=${B2_BERUF_COLLECTION}&limit=10`,
    );
    expect(legacyLevelResponse.status).toBe(400);
  });

  it('maps legacy B2 Beruf lexeme metadata to the B2 Beruf collection filter during migration', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    await dbContext.pool.query(
      'update lexemes set metadata = $1::jsonb where lemma = $2',
      [JSON.stringify({ level: 'B2 Beruf', english: 'employment contract' }), 'Arbeitsvertrag'],
    );
    await dbContext.pool.query(
      [
        "update task_specs set",
        "prompt = prompt - 'collections',",
        "metadata = metadata - 'collections'",
        "where task_type = 'vocabulary_drill'",
        "and lexeme_id = (select id from lexemes where lemma = 'Arbeitsvertrag' limit 1)",
      ].join(' '),
    );

    const collectionResponse = await invokeApi(
      `/api/tasks?taskTypes=vocabulary_drill&collection=${B2_BERUF_COLLECTION}&limit=10`,
    );
    expect(collectionResponse.status).toBe(200);
    const collectionTasks = ((collectionResponse.bodyJson as any).tasks ?? []) as any[];
    expect(collectionTasks.some((task) => task.lexeme?.lemma === 'Arbeitsvertrag')).toBe(true);
    expect(collectionTasks.every((task) => task.lexeme?.lemma !== 'Projekt')).toBe(true);

    const canonicalResponse = await invokeApi(
      `/api/tasks?taskTypes=vocabulary_drill&level=B2&collection=${B2_BERUF_COLLECTION}&limit=10`,
    );
    expect(canonicalResponse.status).toBe(200);
    const canonicalTasks = ((canonicalResponse.bodyJson as any).tasks ?? []) as any[];
    expect(canonicalTasks.length).toBeGreaterThan(0);
    expect(canonicalTasks.some((task) => task.lexeme?.lemma === 'Arbeitsvertrag')).toBe(true);
    expect(canonicalTasks.every((task) => task.prompt?.cefrLevel === 'B2')).toBe(true);
  });

  it('keeps seeded ordering stable and varies order for different seeds', async () => {
    const deviceId = 'seeded-order-device';

    const first = await invokeApi(
      `/api/tasks?taskTypes=conjugate_form&taskTypes=noun_case_declension&taskTypes=adj_ending&limit=12&deviceId=${deviceId}&shuffleSeed=seed-alpha`,
    );
    const second = await invokeApi(
      `/api/tasks?taskTypes=conjugate_form&taskTypes=noun_case_declension&taskTypes=adj_ending&limit=12&deviceId=${deviceId}&shuffleSeed=seed-alpha`,
    );
    const third = await invokeApi(
      `/api/tasks?taskTypes=conjugate_form&taskTypes=noun_case_declension&taskTypes=adj_ending&limit=12&deviceId=${deviceId}&shuffleSeed=seed-beta`,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);

    const firstIds = ((first.bodyJson as any).tasks ?? []).map((task: any) => task.taskId);
    const secondIds = ((second.bodyJson as any).tasks ?? []).map((task: any) => task.taskId);
    const thirdIds = ((third.bodyJson as any).tasks ?? []).map((task: any) => task.taskId);

    expect(firstIds.length).toBeGreaterThan(3);
    expect(secondIds).toEqual(firstIds);
    expect(thirdIds).not.toEqual(firstIds);
  });

  it('records submissions and updates scheduling state', async () => {
    const taskResponse = await invokeApi('/api/tasks?pos=verb&limit=1');
    expect(taskResponse.status).toBe(200);
    const task = (taskResponse.bodyJson as any).tasks[0];
    expect(task).toBeDefined();

    const submission = await invokeApi('/api/submission', {
      method: 'POST',
      body: {
        taskId: task.taskId,
        lexemeId: task.lexeme.id,
        taskType: task.taskType,
        pos: task.pos,
        renderer: task.renderer,
        deviceId: 'device-123',
        result: 'correct',
        timeSpentMs: 1500,
        answeredAt: new Date('2025-01-01T12:00:00.000Z').toISOString(),
      },
    });

    expect(submission.status).toBe(200);
    const submissionBody = submission.bodyJson as any;
    expect(submissionBody.status).toBe('recorded');
    expect(submissionBody.taskId).toBe(task.taskId);
    expect(submissionBody.deviceId).toBe('device-123');
    expect(submissionBody.queueCap).toBeGreaterThan(0);

    const historyResult = await dbContext.pool.query(
      'select task_id, device_id, result, pos, task_type, hints_used, metadata from practice_history where task_id = $1',
      [task.taskId],
    );

    expect(historyResult.rows[0]).toBeDefined();
    expect(historyResult.rows[0]!.device_id).toBe('device-123');
    expect(historyResult.rows[0]!.result).toBe('correct');
    expect(historyResult.rows[0]!.pos).toBe(task.pos);
    expect(historyResult.rows[0]!.task_type).toBe(task.taskType);
    expect(historyResult.rows[0]!.hints_used).toBe(false);
    expect(historyResult.rows[0]!.metadata).toMatchObject({
      queueCap: submissionBody.queueCap,
    });

    const mobileHistoryResult = await dbContext.pool.query(
      'select count(*)::int as count from user_practice_history where task_id = $1',
      [task.taskId],
    );

    expect(mobileHistoryResult.rows[0]!.count).toBe(0);

    const logResult = await dbContext.pool.query(
      'select task_id, device_id, user_id, cefr_level, attempted_at from practice_log where task_id = $1 and device_id = $2',
      [task.taskId, 'device-123'],
    );

    expect(logResult.rows[0]).toBeDefined();
    expect(logResult.rows[0]!.user_id).toBeNull();
    expect(logResult.rows[0]!.cefr_level).toBe('__');
    expect(new Date(logResult.rows[0]!.attempted_at).getTime()).toBeGreaterThan(0);
  });

  it('records authenticated submissions in mobile-compatible and web history tables', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    const userId = 'history-user-1';
    const deviceId = 'history-device-1';
    getSessionFromRequestMock.mockResolvedValue({
      session: { id: 'session-history', expiresAt: new Date().toISOString() },
      user: { id: userId, role: 'standard' },
    } as any);

    const taskResponse = await invokeApi('/api/tasks?taskTypes=conjugate_form&pos=verb&limit=1');
    expect(taskResponse.status).toBe(200);
    const task = (taskResponse.bodyJson as any).tasks[0];
    expect(task).toBeDefined();

    const submittedAt = new Date('2025-02-02T10:00:00.000Z').toISOString();
    const submission = await invokeApi('/api/submission', {
      method: 'POST',
      body: {
        taskId: task.taskId,
        lexemeId: task.lexeme.id,
        taskType: task.taskType,
        pos: task.pos,
        renderer: task.renderer,
        deviceId,
        submittedAt,
        result: 'incorrect',
        submittedResponse: 'gehte',
        expectedResponse: 'ging',
        promptSummary: 'gehen - past tense',
        timeSpentMs: 1800,
        cefrLevel: 'A1',
        hintsUsed: true,
      },
    });

    expect(submission.status).toBe(200);

    const mobileHistory = await dbContext.pool.query(
      [
        'select user_id, task_id, device_id, result, submitted_answer, correct_answer, response_ms, cefr_level, hints_used',
        'from user_practice_history where user_id = $1 and task_id = $2',
      ].join(' '),
      [userId, task.taskId],
    );

    expect(mobileHistory.rowCount).toBe(1);
    expect(mobileHistory.rows[0]).toMatchObject({
      user_id: userId,
      task_id: task.taskId,
      device_id: deviceId,
      result: 'incorrect',
      submitted_answer: 'gehte',
      correct_answer: 'ging',
      response_ms: 1800,
      cefr_level: 'A1',
      hints_used: true,
    });

    const webHistory = await dbContext.pool.query(
      [
        'select user_id, task_id, device_id, result, response_ms, cefr_level, hints_used, metadata',
        'from practice_history where user_id = $1 and task_id = $2',
      ].join(' '),
      [userId, task.taskId],
    );

    expect(webHistory.rowCount).toBe(1);
    expect(webHistory.rows[0]).toMatchObject({
      user_id: userId,
      task_id: task.taskId,
      device_id: deviceId,
      result: 'incorrect',
      response_ms: 1800,
      cefr_level: 'A1',
      hints_used: true,
    });
    expect(webHistory.rows[0]!.metadata).toMatchObject({
      submittedResponse: 'gehte',
      expectedResponse: 'ging',
      promptSummary: 'gehen - past tense',
    });
  });

  it('stores canonical vocabulary ids for direct web vocabulary submissions', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    const task = await fetchFirstVocabularyTask(`level=B2&collection=${B2_BERUF_COLLECTION}`);
    const submission = await invokeApi('/api/submission', {
      method: 'POST',
      body: {
        taskId: task.taskId,
        lexemeId: task.lexeme.id,
        taskType: 'vocabulary_drill',
        pos: task.pos,
        renderer: task.renderer,
        deviceId: 'web-vocab-device-1',
        result: 'correct',
        submittedResponse: task.lexeme.lemma,
        expectedResponse: task.solution?.english ?? 'employment contract',
        timeSpentMs: 700,
        cefrLevel: 'B2',
      },
    });

    expect(submission.status).toBe(200);
    expect((submission.bodyJson as any).taskId).toBe(task.taskId);

    const history = await dbContext.pool.query(
      [
        'select task_id, lexeme_id, task_type from practice_history',
        'where device_id = $1',
      ].join(' '),
      ['web-vocab-device-1'],
    );

    expect(history.rowCount).toBe(1);
    expect(history.rows[0]).toMatchObject({
      task_id: task.taskId,
      lexeme_id: task.lexeme.id,
      task_type: 'vocabulary_drill',
    });
    expect(history.rows[0]!.task_id).not.toMatch(/^word_/);
    expect(history.rows[0]!.lexeme_id).not.toMatch(/^word_/);
  });

  it('resolves legacy Wortschatz word ids to canonical vocabulary history', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    const userId = 'wortschatz-history-user-1';
    const deviceId = 'wortschatz-history-device-1';
    getSessionFromRequestMock.mockResolvedValue({
      session: { id: 'session-wortschatz-history', expiresAt: new Date().toISOString() },
      user: { id: userId, role: 'standard' },
    } as any);

    const legacyTaskId = await insertLegacyWordForLemma('Arbeitsvertrag');

    const submission = await invokeApi('/api/submission', {
      method: 'POST',
      body: {
        taskId: legacyTaskId,
        lexemeId: legacyTaskId,
        taskType: 'vocabulary_drill',
        pos: 'N',
        renderer: 'word_card',
        deviceId,
        submittedAt: new Date('2025-03-03T10:00:00.000Z').toISOString(),
        result: 'correct',
        submittedResponse: 'Arbeitsvertrag',
        expectedResponse: 'employment contract',
        promptSummary: 'Arbeitsvertrag - vocabulary drill',
        timeSpentMs: 900,
        cefrLevel: 'B2',
      },
    });

    expect(submission.status).toBe(200);
    const submissionBody = submission.bodyJson as any;
    expect(submissionBody.taskId).not.toBe(legacyTaskId);
    expect(submissionBody.taskId).toContain(':vocabulary_drill:');

    const canonicalRows = await dbContext.pool.query(
      [
        'select ph.task_id, ph.lexeme_id, uph.task_id as bridge_task_id, uph.lexeme_id as bridge_lexeme_id',
        'from practice_history ph',
        'inner join user_practice_history uph on uph.task_id = ph.task_id',
        'where ph.user_id = $1 and ph.device_id = $2',
      ].join(' '),
      [userId, deviceId],
    );

    expect(canonicalRows.rowCount).toBe(1);
    expect(canonicalRows.rows[0]!.task_id).toBe(submissionBody.taskId);
    expect(canonicalRows.rows[0]!.task_id).not.toMatch(/^word_/);
    expect(canonicalRows.rows[0]!.lexeme_id).not.toMatch(/^word_/);
    expect(canonicalRows.rows[0]!.bridge_task_id).toBe(canonicalRows.rows[0]!.task_id);
    expect(canonicalRows.rows[0]!.bridge_lexeme_id).toBe(canonicalRows.rows[0]!.lexeme_id);

    const leakedLegacyIds = await dbContext.pool.query(
      [
        'select count(*)::int as count from practice_history',
        "where task_type = 'vocabulary_drill'",
        "and (task_id like 'word_%' or lexeme_id like 'word_%')",
      ].join(' '),
    );
    expect(leakedLegacyIds.rows[0]!.count).toBe(0);
  });

  it('resolves legacy Wortschatz lexeme ids to canonical device history', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    const legacyWordRef = await insertLegacyWordForLemma('Arbeitsvertrag');
    const canonicalTask = await fetchFirstVocabularyTask(`level=B2&collection=${B2_BERUF_COLLECTION}`);
    const deviceId = 'legacy-lexeme-device-1';

    const submission = await invokeApi('/api/submission', {
      method: 'POST',
      body: {
        taskId: 'missing-client-task-id',
        lexemeId: legacyWordRef,
        taskType: 'vocabulary_drill',
        pos: 'N',
        renderer: 'word_card',
        deviceId,
        result: 'correct',
        submittedResponse: 'Arbeitsvertrag',
        expectedResponse: 'employment contract',
        timeSpentMs: 900,
        cefrLevel: 'B2',
      },
    });

    expect(submission.status).toBe(200);
    expect((submission.bodyJson as any).taskId).toBe(canonicalTask.taskId);

    const history = await dbContext.pool.query(
      'select task_id, lexeme_id, user_id from practice_history where device_id = $1',
      [deviceId],
    );
    expect(history.rowCount).toBe(1);
    expect(history.rows[0]!.user_id).toBeNull();
    expect(history.rows[0]!.task_id).toBe(canonicalTask.taskId);
    expect(history.rows[0]!.lexeme_id).toBe(canonicalTask.lexeme.id);
    expect(history.rows[0]!.task_id).not.toMatch(/^word_/);
    expect(history.rows[0]!.lexeme_id).not.toMatch(/^word_/);
  });

  it('diagnoses unresolved legacy Wortschatz resolution failures by step', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    const missingWord = await invokeApi('/api/submission', {
      method: 'POST',
      body: {
        taskId: 'word_999999',
        lexemeId: 'word_999999',
        taskType: 'vocabulary_drill',
        pos: 'N',
        renderer: 'word_card',
        deviceId: 'legacy-failure-device-1',
        result: 'incorrect',
        timeSpentMs: 100,
      },
    });
    expect(missingWord.status).toBe(404);
    expect((missingWord.bodyJson as any).details).toMatchObject({
      legacyVocabularyResolutionFailure: 'word_not_found',
    });

    const unsupported = await dbContext.pool.query<{ id: number }>(
      [
        'insert into words',
        '(lemma, pos, level, english, approved, complete)',
        'values ($1, $2, $3, $4, true, true)',
        'returning id',
      ].join(' '),
      ['Fehlerwort', 'Unsupported', 'B2', 'unsupported'],
    );
    const unsupportedResponse = await invokeApi('/api/submission', {
      method: 'POST',
      body: {
        taskId: `word_${unsupported.rows[0]!.id}`,
        lexemeId: `word_${unsupported.rows[0]!.id}`,
        taskType: 'vocabulary_drill',
        pos: 'N',
        renderer: 'word_card',
        deviceId: 'legacy-failure-device-2',
        result: 'incorrect',
        timeSpentMs: 100,
      },
    });
    expect(unsupportedResponse.status).toBe(404);
    expect((unsupportedResponse.bodyJson as any).details).toMatchObject({
      legacyVocabularyResolutionFailure: 'unsupported_pos',
    });

    const missingLexeme = await dbContext.pool.query<{ id: number }>(
      [
        'insert into words',
        '(lemma, pos, level, english, approved, complete)',
        'values ($1, $2, $3, $4, true, true)',
        'returning id',
      ].join(' '),
      ['NichtVorhanden', 'N', 'B2', 'missing'],
    );
    const missingLexemeResponse = await invokeApi('/api/submission', {
      method: 'POST',
      body: {
        taskId: `word_${missingLexeme.rows[0]!.id}`,
        lexemeId: `word_${missingLexeme.rows[0]!.id}`,
        taskType: 'vocabulary_drill',
        pos: 'N',
        renderer: 'word_card',
        deviceId: 'legacy-failure-device-3',
        result: 'incorrect',
        timeSpentMs: 100,
      },
    });
    expect(missingLexemeResponse.status).toBe(404);
    expect((missingLexemeResponse.bodyJson as any).details).toMatchObject({
      legacyVocabularyResolutionFailure: 'lexeme_not_found',
    });

    const legacyWordRef = await insertLegacyWordForLemma('Arbeitsvertrag');
    await dbContext.pool.query(
      [
        'delete from task_specs',
        'where task_type = $1',
        'and lexeme_id = (select id from lexemes where lower(lemma) = lower($2) limit 1)',
      ].join(' '),
      ['vocabulary_drill', 'Arbeitsvertrag'],
    );
    const missingTaskSpecResponse = await invokeApi('/api/submission', {
      method: 'POST',
      body: {
        taskId: legacyWordRef,
        lexemeId: legacyWordRef,
        taskType: 'vocabulary_drill',
        pos: 'N',
        renderer: 'word_card',
        deviceId: 'legacy-failure-device-4',
        result: 'incorrect',
        timeSpentMs: 100,
      },
    });
    expect(missingTaskSpecResponse.status).toBe(404);
    expect((missingTaskSpecResponse.bodyJson as any).details).toMatchObject({
      legacyVocabularyResolutionFailure: 'task_spec_not_found',
    });
  });

  it('upserts practice log rows for both device and user aggregates', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    const deviceId = 'aggregate-device-1';
    const userId = 'aggregate-user-1';

    getSessionFromRequestMock.mockResolvedValue({
      session: { id: 'session-aggregate', expiresAt: new Date().toISOString() },
      user: { id: userId, role: 'standard' },
    } as any);

    const taskResponse = await invokeApi('/api/tasks?taskTypes=conjugate_form&pos=verb&limit=1');
    expect(taskResponse.status).toBe(200);
    const task = (taskResponse.bodyJson as any).tasks[0];
    expect(task).toBeDefined();

    const firstAttemptedAt = new Date().toISOString();
    const firstSubmission = await invokeApi('/api/submission', {
      method: 'POST',
      body: {
        taskId: task.taskId,
        lexemeId: task.lexeme.id,
        taskType: task.taskType,
        pos: task.pos,
        renderer: task.renderer,
        deviceId,
        submittedAt: firstAttemptedAt,
        result: 'correct',
        timeSpentMs: 500,
      },
    });

    expect(firstSubmission.status).toBe(200);

    const deviceLogInitial = await dbContext.pool.query(
      'select attempted_at from practice_log where task_id = $1 and device_id = $2',
      [task.taskId, deviceId],
    );
    expect(deviceLogInitial.rowCount).toBe(1);

    const userLogInitial = await dbContext.pool.query(
      'select attempted_at from practice_log where task_id = $1 and user_id = $2',
      [task.taskId, userId],
    );
    expect(userLogInitial.rowCount).toBe(1);

    const secondAttemptedAt = new Date(Date.now() + 60_000).toISOString();
    const secondSubmission = await invokeApi('/api/submission', {
      method: 'POST',
      body: {
        taskId: task.taskId,
        lexemeId: task.lexeme.id,
        taskType: task.taskType,
        pos: task.pos,
        renderer: task.renderer,
        deviceId,
        submittedAt: secondAttemptedAt,
        result: 'incorrect',
        timeSpentMs: 800,
      },
    });

    expect(secondSubmission.status).toBe(200);

    const deviceLogFinal = await dbContext.pool.query(
      'select attempted_at from practice_log where task_id = $1 and device_id = $2',
      [task.taskId, deviceId],
    );
    expect(deviceLogFinal.rowCount).toBe(1);
    expect(new Date(deviceLogFinal.rows[0]!.attempted_at).getTime()).toBe(
      new Date(secondAttemptedAt).getTime(),
    );

    const userLogFinal = await dbContext.pool.query(
      'select attempted_at from practice_log where task_id = $1 and user_id = $2',
      [task.taskId, userId],
    );
    expect(userLogFinal.rowCount).toBe(1);
    expect(new Date(userLogFinal.rows[0]!.attempted_at).getTime()).toBe(
      new Date(secondAttemptedAt).getTime(),
    );
  });

  it('omits recently practiced tasks for the same device', async () => {
    const deviceId = 'device-queue-123';

    const firstResponse = await invokeApi(`/api/tasks?pos=verb&limit=1&deviceId=${deviceId}`);
    expect(firstResponse.status).toBe(200);
    const firstTask = (firstResponse.bodyJson as any).tasks[0];
    expect(firstTask).toBeDefined();

    const submission = await invokeApi('/api/submission', {
      method: 'POST',
      body: {
        taskId: firstTask.taskId,
        lexemeId: firstTask.lexeme.id,
        taskType: firstTask.taskType,
        pos: firstTask.pos,
        renderer: firstTask.renderer,
        deviceId,
        result: 'correct',
        timeSpentMs: 900,
      },
    });

    expect(submission.status).toBe(200);

    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    const querySpy = vi.spyOn(dbContext.pool, 'query');
    const nextResponse = await invokeApi(`/api/tasks?pos=verb&limit=1&deviceId=${deviceId}`);
    expect(nextResponse.status).toBe(200);
    const nextTask = (nextResponse.bodyJson as any).tasks[0];
    expect(nextTask).toBeDefined();
    expect(nextTask.taskId).not.toBe(firstTask.taskId);

    const practiceLogSelects = querySpy.mock.calls.filter(([sql]) => {
      if (typeof sql !== 'string') {
        return false;
      }
      const normalised = sql.toLowerCase();
      return normalised.includes('select') && normalised.includes('practice_log');
    });

    expect(practiceLogSelects).toHaveLength(1);
    querySpy.mockRestore();
  });

  it('uses user history when available to avoid repeats', async () => {
    getSessionFromRequestMock.mockResolvedValue({
      session: { id: 'session-1', expiresAt: new Date().toISOString() },
      user: { id: 'user-123', role: 'standard' },
    } as any);

    const firstResponse = await invokeApi('/api/tasks?pos=verb&limit=1');
    expect(firstResponse.status).toBe(200);
    const firstTask = (firstResponse.bodyJson as any).tasks[0];
    expect(firstTask).toBeDefined();

    const submission = await invokeApi('/api/submission', {
      method: 'POST',
      body: {
        taskId: firstTask.taskId,
        lexemeId: firstTask.lexeme.id,
        taskType: firstTask.taskType,
        pos: firstTask.pos,
        renderer: firstTask.renderer,
        deviceId: 'user-device-1',
        result: 'correct',
        timeSpentMs: 600,
      },
    });

    expect(submission.status).toBe(200);

    const nextResponse = await invokeApi('/api/tasks?pos=verb&limit=1');
    expect(nextResponse.status).toBe(200);
    const nextTask = (nextResponse.bodyJson as any).tasks[0];
    expect(nextTask).toBeDefined();
    expect(nextTask.taskId).not.toBe(firstTask.taskId);
  });

  it('serves cached task specs when sync results are fresh', async () => {
    const synchronizerModule = await import('../server/tasks/synchronizer.js');
    const syncSpy = vi.spyOn(synchronizerModule, 'ensureTaskSpecsSynced');

    syncSpy.mockClear();
    setTaskSpecCacheTtlMs(5 * 60 * 1000);
    resetTaskSpecCache();

    const firstResponse = await invokeApi('/api/tasks');
    expect(firstResponse.status).toBe(200);

    const secondResponse = await invokeApi('/api/tasks?limit=2');
    expect(secondResponse.status).toBe(200);

    expect(syncSpy).not.toHaveBeenCalled();

    syncSpy.mockRestore();
  });

  it('refreshes task specs when the cache is stale', async () => {
    const synchronizerModule = await import('../server/tasks/synchronizer.js');
    const syncSpy = vi.spyOn(synchronizerModule, 'ensureTaskSpecsSynced');

    syncSpy.mockClear();
    setTaskSpecCacheTtlMs(0);
    resetTaskSpecCache();

    const firstResponse = await invokeApi('/api/tasks');
    expect(firstResponse.status).toBe(200);
    expect(syncSpy).toHaveBeenCalledTimes(1);

    syncSpy.mockClear();

    const secondResponse = await invokeApi('/api/tasks');
    expect(secondResponse.status).toBe(200);
    expect(syncSpy).toHaveBeenCalledTimes(1);

    syncSpy.mockRestore();
  });
});
