import type { LexemePos, TaskType } from '@shared';

interface TaskCopy {
  label: string;
  description: string;
  posLabel: string;
  pos: LexemePos;
}

const DEFAULT_COPY: TaskCopy = {
  label: 'Task',
  description: 'Practice task',
  posLabel: 'Task',
  pos: 'V',
};

export const TASK_TYPE_COPY: Record<TaskType, TaskCopy> = {
  conjugate_form: {
    label: 'Verb conjugation',
    description: 'Strengthen your verb conjugation skills.',
    posLabel: 'Verbs',
    pos: 'V',
  },
  noun_case_declension: {
    label: 'Noun declension',
    description: 'Build confidence with noun case endings.',
    posLabel: 'Nouns',
    pos: 'N',
  },
  adj_ending: {
    label: 'Adjective endings',
    description: 'Master comparative adjective endings.',
    posLabel: 'Adjectives',
    pos: 'Adj',
  },
  b2_writing_prompt: {
    label: 'B2 writing prompt',
    description: 'Practice formal B2 responses with guided key phrases.',
    posLabel: 'B2 writing',
    pos: 'V',
  },
  vocabulary_drill: {
    label: 'Wortschatz',
    description: 'Review vocabulary with a self-graded flashcard.',
    posLabel: 'Wortschatz',
    pos: 'N',
  },
};

export function getTaskTypeCopy(taskType: TaskType): TaskCopy {
  return TASK_TYPE_COPY[taskType] ?? DEFAULT_COPY;
}

export function getTaskTypeLabel(taskType: TaskType): string {
  return getTaskTypeCopy(taskType).label;
}

export function getProgressTaskTypeLabel(taskType: TaskType): string {
  switch (taskType) {
    case 'conjugate_form':
      return 'Verb conjugation';
    case 'noun_case_declension':
      return 'Noun declension';
    case 'adj_ending':
      return 'Adjective endings';
    case 'vocabulary_drill':
      return 'Wortschatz';
    case 'b2_writing_prompt':
      return 'B2 writing prompt';
    default:
      return taskType;
  }
}

export function getTaskTypeDescription(taskType: TaskType): string {
  return getTaskTypeCopy(taskType).description;
}

export function getTaskTypePos(taskType: TaskType): LexemePos {
  return getTaskTypeCopy(taskType).pos;
}
