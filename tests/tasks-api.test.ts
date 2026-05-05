import { getSessionFromRequestMock } from './helpers/mock-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AggregatedWord } from '../scripts/etl/types';
import { B2_BERUF_COLLECTION } from '../shared/content-sources';
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
      level: 'B2',
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
      collections: [B2_BERUF_COLLECTION],
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
        'B2',
        'employment contract',
        'der',
        'Arbeitsvertraege',
        null,
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
    expect(body.tasks.every((task: any) => task.interactionMode === 'typed')).toBe(true);
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
      expect(task.renderer).toBe('word_card');
      expect(task.interactionMode).toBe('self_grade');
      expect(task.grading).toMatchObject({
        type: 'self',
        positive: expect.arrayContaining(['known']),
        negative: expect.arrayContaining(['forgot']),
      });
      expect(task.prompt?.cefrLevel).toBe('B2');
      expect(task.prompt?.collections).toContain(B2_BERUF_COLLECTION);
      expect(task.reveal?.english).toEqual(expect.any(String));
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
        answer: 'correct-answer',
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
      'select task_id, device_id, result, pos, task_type, hints_used, submitted_answer, correct_answer, metadata from practice_history where task_id = $1',
      [task.taskId],
    );

    expect(historyResult.rows[0]).toBeDefined();
    expect(historyResult.rows[0]!.device_id).toBe('device-123');
    expect(historyResult.rows[0]!.result).toBe('correct');
    expect(historyResult.rows[0]!.pos).toBe(task.pos);
    expect(historyResult.rows[0]!.task_type).toBe(task.taskType);
    expect(historyResult.rows[0]!.hints_used).toBe(false);
    expect(historyResult.rows[0]!.submitted_answer).toBe('correct-answer');
    expect(historyResult.rows[0]!.metadata).toMatchObject({
      queueCap: submissionBody.queueCap,
    });

    const logResult = await dbContext.pool.query(
      'select task_id, device_id, user_id, cefr_level, attempted_at from practice_log where task_id = $1 and device_id = $2',
      [task.taskId, 'device-123'],
    );

    expect(logResult.rows[0]).toBeDefined();
    expect(logResult.rows[0]!.user_id).toBeNull();
    expect(logResult.rows[0]!.cefr_level).toBe('__');
    expect(new Date(logResult.rows[0]!.attempted_at).getTime()).toBeGreaterThan(0);
  });

  it('records authenticated submissions in the consolidated history table', async () => {
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

    const history = await dbContext.pool.query(
      [
        'select user_id, task_id, device_id, result, submitted_answer, correct_answer, response_ms, cefr_level, hints_used, metadata',
        'from practice_history where user_id = $1 and task_id = $2',
      ].join(' '),
      [userId, task.taskId],
    );

    expect(history.rowCount).toBe(1);
    expect(history.rows[0]).toMatchObject({
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
    expect(history.rows[0]!.metadata).toMatchObject({
      submittedResponse: 'gehte',
      expectedResponse: 'ging',
      promptSummary: 'gehen - past tense',
    });
  });

  it('reads signed-in answer history from the consolidated practice_history table', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    const userId = 'canonical-history-user-1';
    const deviceId = 'canonical-history-device-1';
    getSessionFromRequestMock.mockResolvedValue({
      session: { id: 'session-canonical-history', expiresAt: new Date().toISOString() },
      user: { id: userId, role: 'standard' },
    } as any);

    const taskResponse = await invokeApi('/api/tasks?taskTypes=conjugate_form&pos=verb&limit=1');
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
        deviceId,
        result: 'incorrect',
        submittedResponse: 'canonical answer',
        expectedResponse: 'expected answer',
        promptSummary: 'canonical prompt',
        timeSpentMs: 1200,
        cefrLevel: 'A1',
      },
    });

    expect(submission.status).toBe(200);

    const historyResponse = await invokeApi(`/api/practice/history?deviceId=${deviceId}&limit=10`);
    expect(historyResponse.status).toBe(200);
    const history = ((historyResponse.bodyJson as any).history ?? []) as any[];

    expect(history).toHaveLength(1);
    expect(history[0].id).toMatch(/^practice_history:/);
    expect(history[0].submittedResponse).toBe('canonical answer');
    expect(history[0].expectedResponse).toBe('expected answer');
    expect(history[0].promptSummary).toBe('canonical prompt');
  });

  it('reads identity-based synced history rows without canonical lexeme joins', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    const userId = 'identity-history-user-1';
    const deviceId = 'identity-history-device-1';
    getSessionFromRequestMock.mockResolvedValue({
      session: { id: 'session-identity-history', expiresAt: new Date().toISOString() },
      user: { id: userId, role: 'standard' },
    } as any);

    await dbContext.pool.query(
      [
        'insert into practice_history',
        '(task_id, lexeme_id, lemma, pos, task_type, renderer, device_id, user_id, result, submitted_answer, correct_answer, response_ms, submitted_at, answered_at, cefr_level, metadata)',
        'values',
        '($1, $2, $3, $4, $5, $6, $7, $8, $9::practice_result, $10, $11, 900, $12, $12, $13, $14::jsonb)',
      ].join(' '),
      [
        'identity:noun:projekt:vocabulary_drill',
        'identity:noun:projekt',
        'Projekt',
        'noun',
        'vocabulary_drill',
        'word_card',
        deviceId,
        userId,
        'correct',
        'Projekt',
        'project',
        new Date('2025-03-03T10:00:00.000Z').toISOString(),
        'B1',
        JSON.stringify({
          submittedResponse: 'Projekt',
          expectedResponse: 'project',
          promptSummary: 'Projekt - vocabulary',
        }),
      ],
    );

    const historyResponse = await invokeApi(`/api/practice/history?deviceId=${deviceId}&limit=10`);
    expect(historyResponse.status).toBe(200);
    const history = ((historyResponse.bodyJson as any).history ?? []) as any[];

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      taskId: 'identity:noun:projekt:vocabulary_drill',
      lexemeId: 'identity:noun:projekt',
      pos: 'noun',
      taskType: 'vocabulary_drill',
      promptSummary: 'Projekt - vocabulary',
    });
    expect(history[0].lexeme).toMatchObject({
      id: 'identity:noun:projekt',
      lemma: 'Projekt',
      pos: 'noun',
    });
  });

  it('returns the Android-aligned recent history window for signed-in progress', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    const userId = 'canonical-history-window-user-1';
    const deviceId = 'canonical-history-window-device-1';
    getSessionFromRequestMock.mockResolvedValue({
      session: { id: 'session-canonical-history-window', expiresAt: new Date().toISOString() },
      user: { id: userId, role: 'standard' },
    } as any);

    const taskResponse = await invokeApi('/api/tasks?taskTypes=conjugate_form&pos=verb&limit=1');
    expect(taskResponse.status).toBe(200);
    const task = (taskResponse.bodyJson as any).tasks[0];
    expect(task).toBeDefined();

    for (let index = 1; index <= 250; index += 1) {
      const submittedAt = new Date(Date.UTC(2025, 3, 1, 0, 0, index)).toISOString();
      await dbContext.pool.query(
        [
          'insert into practice_history',
          '(task_id, lexeme_id, pos, task_type, renderer, device_id, user_id, result, response_ms, submitted_at, answered_at, queued_at, cefr_level, hints_used, metadata)',
          'values',
          '($1, $2, $3, $4, $5, $6, $7, $8::practice_result, 1000, $9, $9, null, $10, false, $11::jsonb)',
        ].join(' '),
        [
          task.taskId,
          task.lexeme.id,
          task.pos,
          task.taskType,
          task.renderer,
          deviceId,
          userId,
          'correct',
          submittedAt,
          'A1',
          JSON.stringify({
            submittedResponse: `answer ${index}`,
            expectedResponse: 'answer',
            promptSummary: `bulk attempt ${index}`,
          }),
        ],
      );
    }

    const historyResponse = await invokeApi(`/api/practice/history?deviceId=${deviceId}&limit=250`);
    expect(historyResponse.status).toBe(200);
    const history = ((historyResponse.bodyJson as any).history ?? []) as any[];

    expect(history).toHaveLength(250);
    expect(history[0].promptSummary).toBe('bulk attempt 250');
    expect(history.every((item) => item.id.startsWith('practice_history:'))).toBe(true);
  });

  it('paginates practice_history rows for signed-in Progress reads', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    const userId = 'canonical-history-pagination-user-1';
    const deviceId = 'canonical-history-pagination-device-1';
    getSessionFromRequestMock.mockResolvedValue({
      session: { id: 'session-canonical-history-pagination', expiresAt: new Date().toISOString() },
      user: { id: userId, role: 'standard' },
    } as any);

    const taskResponse = await invokeApi('/api/tasks?taskTypes=conjugate_form&pos=verb&limit=1');
    expect(taskResponse.status).toBe(200);
    const task = (taskResponse.bodyJson as any).tasks[0];
    expect(task).toBeDefined();

    for (let index = 1; index <= 3; index += 1) {
      const submittedAt = new Date(Date.UTC(2025, 4, 1, 0, 0, index)).toISOString();
      await dbContext.pool.query(
        [
          'insert into practice_history',
          '(task_id, lexeme_id, pos, task_type, renderer, device_id, user_id, result, response_ms, submitted_at, answered_at, queued_at, cefr_level, hints_used, metadata)',
          'values',
          '($1, $2, $3, $4, $5, $6, $7, $8::practice_result, 1000, $9, $9, null, $10, false, $11::jsonb)',
        ].join(' '),
        [
          task.taskId,
          task.lexeme.id,
          task.pos,
          task.taskType,
          task.renderer,
          deviceId,
          userId,
          'correct',
          submittedAt,
          'A1',
          JSON.stringify({
            submittedResponse: `answer ${index}`,
            expectedResponse: 'answer',
            promptSummary: `paginated attempt ${index}`,
          }),
        ],
      );
    }

    const firstPageResponse = await invokeApi(`/api/practice/history?deviceId=${deviceId}&limit=2`);
    expect(firstPageResponse.status).toBe(200);
    const firstPage = ((firstPageResponse.bodyJson as any).history ?? []) as any[];
    expect(firstPage).toHaveLength(2);
    expect(firstPage[0].promptSummary).toBe('paginated attempt 3');

    const secondPageResponse = await invokeApi(`/api/practice/history?deviceId=${deviceId}&limit=2&offset=2`);
    expect(secondPageResponse.status).toBe(200);
    const secondPage = ((secondPageResponse.bodyJson as any).history ?? []) as any[];
    expect(secondPage).toHaveLength(1);
    expect(secondPage[0].promptSummary).toBe('paginated attempt 1');
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
        submittedResponse: { selfAssessment: 'known' },
        expectedResponse: task.solution,
        timeSpentMs: 700,
        cefrLevel: 'B2',
      },
    });

    expect(submission.status).toBe(200);
    expect((submission.bodyJson as any).taskId).toBe(task.taskId);

    const history = await dbContext.pool.query(
      [
        'select task_id, lexeme_id, task_type, submitted_answer, correct_answer, metadata from practice_history',
        'where device_id = $1',
      ].join(' '),
      ['web-vocab-device-1'],
    );

    expect(history.rowCount).toBe(1);
    expect(history.rows[0]).toMatchObject({
      task_id: task.taskId,
      lexeme_id: task.lexeme.id,
      task_type: 'vocabulary_drill',
      submitted_answer: 'known',
    });
    expect(history.rows[0]!.correct_answer).toContain('employment contract');
    expect(history.rows[0]!.metadata).toMatchObject({
      submittedResponse: { selfAssessment: 'known' },
      expectedResponse: task.solution,
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
        'select ph.task_id, ph.lexeme_id',
        'from practice_history ph',
        'where ph.user_id = $1 and ph.device_id = $2',
      ].join(' '),
      [userId, deviceId],
    );

    expect(canonicalRows.rowCount).toBe(1);
    expect(canonicalRows.rows[0]!.task_id).toBe(submissionBody.taskId);
    expect(canonicalRows.rows[0]!.task_id).not.toMatch(/^word_/);
    expect(canonicalRows.rows[0]!.lexeme_id).not.toMatch(/^word_/);

    const leakedLegacyIds = await dbContext.pool.query(
      [
        'select count(*)::int as count from practice_history',
        "where task_type = 'vocabulary_drill'",
        "and (task_id like 'word_%' or lexeme_id like 'word_%')",
      ].join(' '),
    );
    expect(leakedLegacyIds.rows[0]!.count).toBe(0);
  });

  it('returns B2 Beruf collection metadata for synced canonical vocabulary history', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    const userId = 'wortschatz-history-user-metadata';
    const deviceId = 'wortschatz-history-device-metadata';
    getSessionFromRequestMock.mockResolvedValue({
      session: { id: 'session-wortschatz-history-metadata', expiresAt: new Date().toISOString() },
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
        result: 'correct',
        submittedResponse: 'Arbeitsvertrag',
        expectedResponse: 'employment contract',
        promptSummary: 'Arbeitsvertrag - vocabulary drill',
        timeSpentMs: 900,
      },
    });

    expect(submission.status).toBe(200);

    const historyResponse = await invokeApi(`/api/practice/history?deviceId=${deviceId}&limit=10`);
    expect(historyResponse.status).toBe(200);
    const history = ((historyResponse.bodyJson as any).history ?? []) as any[];

    expect(history).toHaveLength(1);
    expect(history[0].taskType).toBe('vocabulary_drill');
    expect(history[0].level).toBe('B2');
    expect(history[0].cefrLevel).toBe('B2');
    expect(history[0].collections).toContain(B2_BERUF_COLLECTION);
    expect(history[0].lexeme?.level).toBe('B2');
    expect(history[0].lexeme?.collections).toContain(B2_BERUF_COLLECTION);
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
