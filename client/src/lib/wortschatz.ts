import { z } from 'zod';

import type { WortschatzWord } from '@shared';
import { ANDROID_B2_BERUF_VERSION } from '@shared/content-sources';
import { getDeviceId } from './device';
import { createSupabaseAuthHeaders } from './supabase';

const partOfSpeechSchema = z.enum([
  'V',
  'N',
  'Adj',
  'Adv',
  'Pron',
  'Det',
  'Präp',
  'Konj',
  'Num',
  'Part',
  'Interj',
]);

const wortschatzWordSchema = z.object({
  id: z.number().int(),
  lemma: z.string(),
  pos: partOfSpeechSchema,
  level: z.string().nullable(),
  english: z.string().nullable(),
  exampleDe: z.string().nullable(),
  exampleEn: z.string().nullable(),
  gender: z.string().nullable(),
  plural: z.string().nullable(),
});

const wortschatzWordsSchema = z.array(wortschatzWordSchema);

const wortschatzWordHistorySummarySchema = z.object({
  attempts: z.number(),
  correct: z.number(),
  incorrect: z.number(),
});

const wortschatzHistorySummarySchema = z.object({
  totalAttempts: z.number(),
  correctAttempts: z.number(),
  incorrectAttempts: z.number(),
  practicedWordIds: z.array(z.number().int()),
  correctWordIds: z.array(z.number().int()),
  byWordId: z.record(z.string(), wortschatzWordHistorySummarySchema),
});

export const WORTSCHATZ_QUERY_KEY = ['wortschatz-words'] as const;
export const WORTSCHATZ_HISTORY_SUMMARY_QUERY_KEY = ['wortschatz-history-summary'] as const;

export interface WortschatzWordsResponse {
  words: WortschatzWord[];
  datasetVersion: string;
}

export type WortschatzHistorySummary = z.infer<typeof wortschatzHistorySummarySchema>;

export async function fetchWortschatzWords(): Promise<WortschatzWordsResponse> {
  const response = await fetch('/api/wortschatz/words', {
    credentials: 'include',
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load Wortschatz words (${response.status})`);
  }

  const payload = await response.json();
  const words = wortschatzWordsSchema.parse(payload);
  const datasetVersion =
    response.headers.get('x-wortschatz-dataset-version') ?? ANDROID_B2_BERUF_VERSION;

  return {
    words,
    datasetVersion,
  };
}

export async function fetchWortschatzHistorySummary(): Promise<WortschatzHistorySummary> {
  const params = new URLSearchParams({ deviceId: getDeviceId() });
  const response = await fetch(`/api/wortschatz/history-summary?${params.toString()}`, {
    credentials: 'include',
    headers: await createSupabaseAuthHeaders({ accept: 'application/json' }),
  });

  if (!response.ok) {
    throw new Error(`Failed to load Wortschatz history summary (${response.status})`);
  }

  const payload = await response.json().catch(() => ({}));
  return wortschatzHistorySummarySchema.parse(payload);
}
