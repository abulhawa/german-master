import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import type { AggregatedWord } from '../scripts/etl/types';
import { B2_BERUF_COLLECTION } from '../shared/content-sources';
import { setupTestDatabase, type TestDatabaseContext } from './helpers/pg';

describe('canonical vocabulary readiness verification', () => {
  const words: AggregatedWord[] = [
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

  let dbContext: TestDatabaseContext | undefined;
  let drizzleDb: typeof import('@db').db;
  let taskSpecsTable: typeof import('../db/schema.js').taskSpecs;
  let seedLexemeInventoryForWords: typeof import('./helpers/task-fixtures').seedLexemeInventoryForWords;
  let ensureTaskSpecsSynced: typeof import('../server/tasks/synchronizer.js').ensureTaskSpecsSynced;
  let resetTaskSpecSync: typeof import('../server/tasks/synchronizer.js').resetTaskSpecSync;
  let inspectCanonicalVocabularyReadiness: typeof import('../scripts/canonical-vocabulary-readiness.js').inspectCanonicalVocabularyReadiness;
  let createCanonicalVocabularyReadinessReport: typeof import('../scripts/canonical-vocabulary-readiness.js').createCanonicalVocabularyReadinessReport;

  beforeEach(async () => {
    dbContext = await setupTestDatabase();
    dbContext.mock();

    const dbModule = await import('@db');
    drizzleDb = dbModule.db;
    const schemaModule = await import('../db/schema.js');
    taskSpecsTable = schemaModule.taskSpecs;

    ({ seedLexemeInventoryForWords } = await import('./helpers/task-fixtures'));
    ({ ensureTaskSpecsSynced, resetTaskSpecSync } = await import('../server/tasks/synchronizer.js'));
    ({
      inspectCanonicalVocabularyReadiness,
      createCanonicalVocabularyReadinessReport,
    } = await import('../scripts/canonical-vocabulary-readiness.js'));

    await seedLexemeInventoryForWords(drizzleDb, words);
    await dbContext.pool.query(
      [
        'insert into words',
        '(lemma, pos, level, english, gender, plural, approved, complete, collections)',
        'values',
        '($1, $2, $3, $4, $5, $6, true, true, $7::jsonb),',
        '($8, $9, $10, $11, $12, $13, true, true, $14::jsonb)',
      ].join(' '),
      [
        'Projekt',
        'N',
        'B2',
        'project',
        'das',
        'Projekte',
        JSON.stringify([]),
        'Arbeitsvertrag',
        'N',
        'B2',
        'employment contract',
        'der',
        'Arbeitsvertraege',
        JSON.stringify([B2_BERUF_COLLECTION]),
      ],
    );
    resetTaskSpecSync();
    await ensureTaskSpecsSynced();
  });

  afterEach(async () => {
    if (dbContext) {
      await dbContext.cleanup();
      dbContext = undefined;
    }
  });

  it('reports canonical vocabulary prerequisites when present', async () => {
    const report = await inspectCanonicalVocabularyReadiness();

    expect(report.vocabularyTaskSpecCount).toBeGreaterThan(0);
    expect(report.b2LexemeCount).toBeGreaterThanOrEqual(2);
    expect(report.b2BerufLexemeCount).toBe(1);
    expect(report.wordsResolvableToLexemes).toBe(2);
    expect(report.wordsUnresolvableToLexemes).toBe(0);
    expect(report.vocabularyTaskSpecsWithMissingLexemeReferences).toBe(0);
    expect(report.duplicateVocabularyTaskIds).toEqual([]);
    expect(report.duplicateVocabularyLexemeTaskPairs).toEqual([]);
    expect(report.b2BerufVocabularyTaskQueryable).toBe(true);
    expect(report.b2BerufLevelMisclassifiedCount).toBe(0);
    expect(report.issues).toEqual([]);
  });

  it('does not treat runtime legacy B2 Beruf fallback as canonical readiness', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    await dbContext.pool.query(
      'update lexemes set metadata = $1::jsonb where lemma = $2',
      [JSON.stringify({ level: 'B2 Beruf', english: 'employment contract' }), 'Arbeitsvertrag'],
    );

    const report = await inspectCanonicalVocabularyReadiness();

    expect(report.b2BerufVocabularyTaskQueryable).toBe(true);
    expect(report.b2BerufLevelMisclassifiedCount).toBe(1);
    expect(report.issues).toContain('B2_BERUF_LEVEL_NOT_CANONICAL');
    expect(report.issues).not.toContain('B2_BERUF_NOT_QUERYABLE');
  });

  it('fails when B2 Beruf only exists as legacy level metadata without canonical collection support', async () => {
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

    const report = await inspectCanonicalVocabularyReadiness();

    expect(report.b2BerufVocabularyTaskQueryable).toBe(false);
    expect(report.b2BerufLevelMisclassifiedCount).toBe(1);
    expect(report.issues).toContain('B2_BERUF_LEVEL_NOT_CANONICAL');
    expect(report.issues).toContain('B2_BERUF_NOT_QUERYABLE');
  });

  it('reports missing vocabulary_drill task specs', async () => {
    await drizzleDb
      .delete(taskSpecsTable)
      .where(eq(taskSpecsTable.taskType, 'vocabulary_drill'));

    const report = await inspectCanonicalVocabularyReadiness();

    expect(report.vocabularyTaskSpecCount).toBe(0);
    expect(report.issues).toContain('NO_VOCABULARY_TASK_SPECS');
    expect(report.issues).toContain('B2_BERUF_NOT_QUERYABLE');
  });

  it('reports words that cannot map to canonical lexemes', async () => {
    if (!dbContext) {
      throw new Error('test database not initialised');
    }

    await dbContext.pool.query(
      [
        'insert into words',
        '(lemma, pos, level, english, approved, complete)',
        'values ($1, $2, $3, $4, true, true)',
      ].join(' '),
      ['NichtVorhanden', 'N', 'B2', 'missing'],
    );

    const report = await inspectCanonicalVocabularyReadiness();

    expect(report.wordsUnresolvableToLexemes).toBe(1);
    expect(report.issues).toContain('MISSING_LEXEME_MAPPING');
  });

  it('reports duplicate vocabulary task IDs and duplicate lexeme/task pairs', () => {
    const report = createCanonicalVocabularyReadinessReport({
      counts: {
        vocabularyTaskSpecCount: 2,
        b2LexemeCount: 1,
        b2BerufLexemeCount: 1,
        wordsResolvableToLexemes: 1,
        wordsUnresolvableToLexemes: 0,
        vocabularyTaskSpecsWithMissingLexemeReferences: 0,
        b2BerufVocabularyTaskQueryable: true,
        b2BerufLevelMisclassifiedCount: 0,
      },
      duplicateVocabularyTaskIds: [{ taskId: 'task:duplicate', count: 2 }],
      duplicateVocabularyLexemeTaskPairs: [
        { lexemeId: 'de:noun:arbeitsvertrag:test', taskType: 'vocabulary_drill', count: 2 },
      ],
    });

    expect(report.issues).toContain('DUPLICATE_TASK_ID');
    expect(report.issues).toContain('DUPLICATE_LEXEME_TASK_PAIR');
  });

  it('requires B2 Beruf to be represented as level B2 plus collection metadata', () => {
    const report = createCanonicalVocabularyReadinessReport({
      counts: {
        vocabularyTaskSpecCount: 1,
        b2LexemeCount: 0,
        b2BerufLexemeCount: 0,
        wordsResolvableToLexemes: 1,
        wordsUnresolvableToLexemes: 0,
        vocabularyTaskSpecsWithMissingLexemeReferences: 0,
        b2BerufVocabularyTaskQueryable: false,
        b2BerufLevelMisclassifiedCount: 1,
      },
    });

    expect(B2_BERUF_COLLECTION).toBe('b2_beruf');
    expect(report.issues).toContain('B2_BERUF_LEVEL_NOT_CANONICAL');
    expect(report.issues).toContain('B2_BERUF_NOT_QUERYABLE');
  });
});
