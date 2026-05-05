import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { B2_BERUF_COLLECTION } from '@shared/content-sources';

import { aggregateWords, keyFor } from '../../../scripts/seed/loaders/words';

async function setupPosFile(root: string, filename: string, records: unknown[]): Promise<void> {
  const posDir = path.join(root, 'data', 'pos');
  await fs.mkdir(posDir, { recursive: true });
  const content = records.map((record) => JSON.stringify(record)).join('\n');
  await fs.writeFile(path.join(posDir, filename), `${content}\n`, 'utf8');
}

describe('seed loaders', () => {
  it('creates consistent keys', () => {
    expect(keyFor('Haus', 'N')).toBe('haus::N');
  });

  it('loads and aggregates POS data from disk', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'seed-loader-test-'));

    try {
      await setupPosFile(tmpRoot, 'verbs.jsonl', [
        {
          lemma: 'laufen',
          level: 'B1',
          english: 'to run',
          verb: {
            praesens: { ich: 'laufe', er: 'läuft' },
            praeteritum: 'lief',
            partizipIi: 'gelaufen',
            perfekt: 'ist gelaufen',
          },
          examples: [
            { sentence: 'Ich laufe nach Hause.', translations: { en: 'I run home.' } },
          ],
          approved: true,
        },
      ]);

      await setupPosFile(tmpRoot, 'nouns.jsonl', [
        {
          lemma: 'Haus',
          level: 'A1',
          english: 'house',
          noun: { gender: 'das', plural: 'Häuser' },
          examples: [
            { sentence: 'Das Haus ist groß.', translations: { en: 'The house is big.' } },
          ],
        },
      ]);

      await setupPosFile(tmpRoot, 'prepositions.jsonl', [
        {
          lemma: 'wegen',
          level: 'B1',
          english: 'because of',
          preposition: { cases: ['Genitiv'] },
          examples: [
            {
              sentence: 'Wegen des Regens bleiben wir zuhause.',
              translations: { en: 'Because of the rain we stay home.' },
            },
          ],
        },
      ]);

      const aggregated = await aggregateWords(tmpRoot);

      expect(aggregated).toHaveLength(3);
      const laufen = aggregated.find((entry) => entry.lemma === 'laufen');
      expect(laufen?.approved).toBe(true);
      expect(laufen?.complete).toBe(true);
      expect(laufen?.examples).toHaveLength(1);

      const haus = aggregated.find((entry) => entry.lemma === 'Haus');
      expect(haus?.gender).toBe('das');
      expect(haus?.plural).toBe('Häuser');

      const wegen = aggregated.find((entry) => entry.lemma === 'wegen');
      expect(wegen?.pos).toBe('Präp');
      expect(wegen?.posAttributes).toMatchObject({
        pos: 'Präp',
        preposition: { cases: ['Genitiv'] },
      });
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it('keeps explicit collection metadata from POS JSONL records', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'seed-loader-bundled-'));

    try {
      await setupPosFile(tmpRoot, 'nouns.jsonl', [
        {
          lemma: 'Projekt',
          level: 'B2',
          english: 'project',
          noun: { gender: 'das', plural: 'Projekte' },
          examples: [
            {
              sentence: 'Das Projekt braucht einen klaren Zeitplan.',
              translations: { en: 'The project needs a clear timeline.' },
            },
          ],
          collections: [B2_BERUF_COLLECTION],
          approved: true,
        },
      ]);

      const aggregated = await aggregateWords(tmpRoot);

      expect(aggregated).toHaveLength(1);
      expect(aggregated[0]).toMatchObject({
        lemma: 'Projekt',
        pos: 'N',
        level: 'B2',
        english: 'project',
        gender: 'das',
        plural: 'Projekte',
        collections: [B2_BERUF_COLLECTION],
      });
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });
});
