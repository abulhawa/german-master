import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { B2_BERUF_COLLECTION } from '@shared/content-sources';

import { setupTestDatabase, type TestDatabaseContext } from './helpers/pg';
import { createApiInvoker } from './helpers/vercel';

describe('wortschatz API', () => {
  let dbContext: TestDatabaseContext | undefined;
  let invokeApi: ReturnType<typeof createApiInvoker>;

  beforeEach(async () => {
    const context = await setupTestDatabase();
    dbContext = context;
    context.mock();

    const schema = await import('../db/schema.js');
    await context.db.insert(schema.words).values([
      {
        lemma: 'Projekt',
        pos: 'N',
        level: 'B2',
        english: 'project',
        exampleDe: 'Das Projekt braucht einen klaren Zeitplan.',
        exampleEn: 'The project needs a clear timeline.',
        gender: 'das',
        plural: 'Projekte',
        approved: true,
        complete: true,
      },
      {
        lemma: 'bewerben',
        pos: 'V',
        level: 'B2',
        english: 'to apply',
        exampleDe: 'Sie bewirbt sich auf die Stelle.',
        exampleEn: 'She is applying for the position.',
        approved: true,
        complete: true,
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
        approved: true,
        complete: true,
      },
    ]);

    await context.db.insert(schema.lexemes).values([
      {
        id: 'de:noun:projekt:11111111',
        lemma: 'Projekt',
        pos: 'noun',
        metadata: { level: 'B2', collections: [B2_BERUF_COLLECTION] },
      },
      {
        id: 'de:verb:bewerben:22222222',
        lemma: 'bewerben',
        pos: 'verb',
        metadata: { level: 'B2', collections: [B2_BERUF_COLLECTION] },
      },
      {
        id: 'de:noun:haus:33333333',
        lemma: 'Haus',
        pos: 'noun',
        metadata: { level: 'A1', collections: [] },
      },
    ]);

    const { createVercelApiHandler } = await import('../server/api/vercel-handler.js');
    invokeApi = createApiInvoker(createVercelApiHandler({ enableCors: false }));
  });

  afterEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    if (dbContext) {
      await dbContext.cleanup();
      dbContext = undefined;
    }
  });

  it('returns only collection-tagged words in the public response shape', async () => {
    const response = await invokeApi('/api/wortschatz/words');

    expect(response.status).toBe(200);
    expect(response.headers.get('x-wortschatz-dataset-version')).toMatch(/^[a-f0-9]{40}$/);

    const body = response.bodyJson as Array<Record<string, unknown>>;
    expect(body).toEqual([
      {
        id: expect.any(Number),
        lemma: 'bewerben',
        pos: 'V',
        level: 'B2',
        english: 'to apply',
        exampleDe: 'Sie bewirbt sich auf die Stelle.',
        exampleEn: 'She is applying for the position.',
        gender: null,
        plural: null,
      },
      {
        id: expect.any(Number),
        lemma: 'Projekt',
        pos: 'N',
        level: 'B2',
        english: 'project',
        exampleDe: 'Das Projekt braucht einen klaren Zeitplan.',
        exampleEn: 'The project needs a clear timeline.',
        gender: 'das',
        plural: 'Projekte',
      },
    ]);

    expect(body).toHaveLength(2);
    expect(body[0]).not.toHaveProperty('sourcesCsv');
    expect(body[0]).not.toHaveProperty('sourceNotes');
  });
});
