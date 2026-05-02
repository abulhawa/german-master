import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createMockPool } from './helpers/mock-pg';

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
let applyMigrations: typeof import('../scripts/db-push').applyMigrations;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgres://local.test/database';
  }

  ({ applyMigrations } = await import('../scripts/db-push'));
});

afterAll(() => {
  if (ORIGINAL_DATABASE_URL === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
});

describe('applyMigrations', () => {
  it('creates the expected tables and indexes in a fresh database', async () => {
    const pool = createMockPool();

    await applyMigrations(pool);

    const tables = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );

    const tableNames = tables.rows.map((row) => row.table_name);

    expect(tableNames).toEqual(
      expect.arrayContaining([
        'lexemes',
        'task_specs',
        'practice_history',
        'user_practice_history',
      ]),
    );
    expect(tableNames).not.toEqual(
      expect.arrayContaining([
        'auth_accounts',
        'auth_sessions',
        'auth_users',
        'auth_verifications',
        'background_job_runs',
      ]),
    );

    await pool.query(
      "insert into lexemes (id, lemma, language, pos, source_ids, metadata) values ($1, $2, 'de', 'verb', $3::jsonb, $4::jsonb)",
      ['lex:1', 'gehen', '[]', '{}'],
    );

    await expect(
      pool.query(
        "insert into lexemes (id, lemma, language, pos, source_ids, metadata) values ($1, $2, 'de', 'verb', $3::jsonb, $4::jsonb)",
        ['lex:2', 'gehen', '[]', '{}'],
      ),
    ).rejects.toThrow(/unique/i);

    await pool.query(
      [
        "insert into task_specs (id, lexeme_id, pos, task_type, renderer, prompt, solution)",
        "values ($1, $2, 'verb', 'conjugate_form', 'conjugate_form', $3::jsonb, $4::jsonb)",
      ].join(' '),
      ['task:1', 'lex:1', '{}', '{"form":"gehe"}'],
    );

    await pool.query(
      [
        'insert into user_practice_history',
        '(user_id, task_id, lexeme_id, lemma, pos, task_type, renderer, device_id, result, submitted_answer, correct_answer, response_ms, submitted_at)',
        'values',
        "('user:1', 'task:1', 'lex:1', 'gehen', 'verb', 'conjugate_form', 'conjugate_form', 'device:1', 'correct', 'gehe', 'gehe', 1200, '2025-01-01T00:00:00Z'),",
        "('user:1', 'missing-task', 'lex:1', 'gehen', 'verb', 'conjugate_form', 'conjugate_form', 'device:1', 'correct', 'gehe', 'gehe', 1200, '2025-01-02T00:00:00Z')",
      ].join(' '),
    );

    const backfillSql = await readFile(resolve('migrations/0007_backfill_practice_history_from_mobile.sql'), 'utf8');
    await pool.query(backfillSql);
    await pool.query(backfillSql);

    const backfilled = await pool.query(
      'select user_id, task_id, device_id, result, response_ms, metadata from practice_history where user_id = $1',
      ['user:1'],
    );

    expect(backfilled.rowCount).toBe(1);
    expect(backfilled.rows[0]).toMatchObject({
      user_id: 'user:1',
      task_id: 'task:1',
      device_id: 'device:1',
      result: 'correct',
      response_ms: 1200,
    });
    expect(backfilled.rows[0]!.metadata).toMatchObject({
      submittedResponse: 'gehe',
      expectedResponse: 'gehe',
      backfilledFrom: 'user_practice_history',
    });

    await pool.end();
  });
});
