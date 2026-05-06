import { z } from 'zod';

export const conjugatePromptSchema = z.object({
  lemma: z.string().min(1),
  pos: z.literal('V'),
  requestedForm: z.object({
    tense: z.enum(['present', 'past', 'participle']),
    mood: z.enum(['indicative', 'subjunctive']).optional(),
    person: z.number().int().min(1).max(3).optional(),
    number: z.enum(['singular', 'plural']).optional(),
    voice: z.enum(['active', 'passive']).optional(),
  }),
  cefrLevel: z.string().optional(),
  instructions: z.string().min(1),
  example: z
    .object({
      de: z.string().optional(),
      en: z.string().optional(),
    })
    .optional(),
});

export const conjugateSolutionSchema = z.object({
  form: z.string().min(1),
  alternateForms: z.array(z.string().min(1)).optional(),
});

export const nounDeclensionPromptSchema = z.object({
  lemma: z.string().min(1),
  pos: z.literal('N'),
  gender: z.enum(['der', 'die', 'das', 'der/die', 'der/das', 'die/das']).optional(),
  requestedCase: z.enum(['nominative', 'accusative', 'dative', 'genitive']),
  requestedNumber: z.enum(['singular', 'plural']),
  instructions: z.string().min(1),
  cefrLevel: z.string().optional(),
  example: z
    .object({
      de: z.string().optional(),
      en: z.string().optional(),
    })
    .optional(),
});

export const nounDeclensionSolutionSchema = z.object({
  form: z.string().min(1),
  article: z.string().optional(),
});

export const adjectiveEndingPromptSchema = z.object({
  lemma: z.string().min(1),
  pos: z.literal('Adj'),
  degree: z.enum(['positive', 'comparative', 'superlative']),
  syntacticFrame: z.string().optional(),
  instructions: z.string().min(1),
  cefrLevel: z.string().optional(),
  example: z
    .object({
      de: z.string().optional(),
      en: z.string().optional(),
    })
    .optional(),
});

export const adjectiveEndingSolutionSchema = z.object({
  form: z.string().min(1),
});

export const b2WritingPromptSchema = z.object({
  scenario: z.string().min(1),
  wordBankItems: z.array(z.string().min(1)),
  cefrLevel: z.string().optional(),
  taskInstructions: z.string().min(1),
});

export const b2WritingSolutionSchema = z.object({
  keyPhrases: z.array(z.string().min(1)),
  grammarFocus: z.string().min(1),
});

export const vocabularyDrillPromptSchema = z.object({
  lemma: z.string().min(1),
  pos: z.enum([
    'V',
    'N',
    'Adj',
    'Adv',
    'Pron',
    'Präp',
    'Konj',
    'Part',
  ]),
  cefrLevel: z.string().optional(),
  collections: z.array(z.string().min(1)).optional(),
  instructions: z.string().min(1),
  example: z
    .object({
      de: z.string().optional(),
      en: z.string().optional(),
    })
    .optional(),
});

export const vocabularyDrillSolutionSchema = z.object({
  answer: z.string().min(1),
  english: z.string().min(1),
});

export type LexemePos =
  | 'V'
  | 'N'
  | 'Adj'
  | 'Adv'
  | 'Pron'
  | 'Präp'
  | 'Konj'
  | 'Part';

export type TaskInteractionMode = 'choice' | 'typed' | 'self_grade' | 'writing';
export type TaskGrading =
  | { readonly type: 'system' }
  | {
      readonly type: 'self';
      readonly positive: readonly string[];
      readonly negative: readonly string[];
    };

interface TaskRegistryEntryBase {
  readonly taskType: string;
  readonly supportedPos: ReadonlyArray<LexemePos>;
  readonly renderer: string;
  readonly interactionMode: TaskInteractionMode;
  readonly grading: TaskGrading;
  readonly promptSchema: z.ZodTypeAny;
  readonly solutionSchema: z.ZodTypeAny;
  readonly defaultQueueCap: number;
}

export const taskTypeRegistry = {
  conjugate_form: {
    taskType: 'conjugate_form',
    supportedPos: ['V'],
    renderer: 'conjugate_form',
    interactionMode: 'typed',
    grading: { type: 'system' },
    promptSchema: conjugatePromptSchema,
    solutionSchema: conjugateSolutionSchema,
    defaultQueueCap: 30,
  },
  noun_case_declension: {
    taskType: 'noun_case_declension',
    supportedPos: ['N'],
    renderer: 'noun_case_declension',
    interactionMode: 'typed',
    grading: { type: 'system' },
    promptSchema: nounDeclensionPromptSchema,
    solutionSchema: nounDeclensionSolutionSchema,
    defaultQueueCap: 25,
  },
  adj_ending: {
    taskType: 'adj_ending',
    supportedPos: ['Adj'],
    renderer: 'adj_ending',
    interactionMode: 'typed',
    grading: { type: 'system' },
    promptSchema: adjectiveEndingPromptSchema,
    solutionSchema: adjectiveEndingSolutionSchema,
    defaultQueueCap: 20,
  },
  b2_writing_prompt: {
    taskType: 'b2_writing_prompt',
    supportedPos: ['V', 'Adj', 'N'],
    renderer: 'b2_writing_prompt',
    interactionMode: 'writing',
    grading: { type: 'system' },
    promptSchema: b2WritingPromptSchema,
    solutionSchema: b2WritingSolutionSchema,
    defaultQueueCap: 3,
  },
  vocabulary_drill: {
    taskType: 'vocabulary_drill',
    supportedPos: [
      'V',
      'N',
      'Adj',
      'Adv',
      'Pron',
      'Präp',
      'Konj',
      'Part',
    ],
    renderer: 'word_card',
    interactionMode: 'self_grade',
    grading: {
      type: 'self',
      positive: ['known', 'remembered'],
      negative: ['forgot', 'not_known'],
    },
    promptSchema: vocabularyDrillPromptSchema,
    solutionSchema: vocabularyDrillSolutionSchema,
    defaultQueueCap: 50,
  },
} as const satisfies Record<string, TaskRegistryEntryBase>;

export type TaskRegistry = typeof taskTypeRegistry;

export type TaskType = keyof TaskRegistry;

export type TaskRegistryEntry = TaskRegistry[TaskType];

export interface RegistryValidationResult {
  taskType: TaskType;
  pos: LexemePos;
  renderer: TaskRegistryEntry['renderer'];
}

export function validateTaskAgainstRegistry(
  taskType: string,
  pos: string,
  renderer: string,
  prompt: unknown,
  solution: unknown,
): RegistryValidationResult {
  const entry = taskTypeRegistry[taskType as TaskType];
  if (!entry) {
    throw new Error(`Unsupported task type: ${taskType}`);
  }

  const supportedPos = entry.supportedPos as ReadonlyArray<LexemePos>;
  if (!supportedPos.includes(pos as LexemePos)) {
    throw new Error(
      `Task type ${taskType} does not support part of speech ${pos}. Supported: ${entry.supportedPos.join(', ')}`,
    );
  }

  if (entry.renderer !== renderer) {
    throw new Error(
      `Renderer mismatch for ${taskType}: expected ${entry.renderer} but received ${renderer}`,
    );
  }

  entry.promptSchema.parse(prompt);
  entry.solutionSchema.parse(solution);

  return {
    taskType: entry.taskType,
    pos: pos as LexemePos,
    renderer,
  };
}
