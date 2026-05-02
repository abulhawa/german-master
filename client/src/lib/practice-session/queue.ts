import type { PracticeResult } from '@shared';

import type { PracticeTask } from '@/lib/tasks';

import { MAX_RECENT_HISTORY, type PracticeSessionState } from './state';

function shuffleArray<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function buildRecentHistory(recent: string[], taskId: string): string[] {
  const filteredRecent = recent.filter((id) => id !== taskId);
  filteredRecent.unshift(taskId);
  return filteredRecent.slice(0, MAX_RECENT_HISTORY);
}

function appendIfMissing(queue: string[], taskId: string): string[] {
  return queue.includes(taskId) ? queue : [...queue, taskId];
}

export function enqueueTasks(
  state: PracticeSessionState,
  tasks: PracticeTask[],
  options: { replace?: boolean; ignoreRecent?: boolean; ignoreCompleted?: boolean } = {},
): PracticeSessionState {
  const { replace = false } = options;
  const ignoreRecent = options.ignoreRecent ?? replace;
  const ignoreCompleted = options.ignoreCompleted ?? replace;
  const nextQueue = replace ? [] : [...state.queue];
  const seen = new Set(nextQueue);

  if (!ignoreCompleted) {
    for (const taskId of state.completed) {
      seen.add(taskId);
    }
  }

  if (!ignoreRecent) {
    for (const taskId of state.recent) {
      seen.add(taskId);
    }
  }

  for (const task of shuffleArray(tasks)) {
    if (seen.has(task.taskId)) {
      continue;
    }
    seen.add(task.taskId);
    nextQueue.push(task.taskId);
  }

  const candidateActive = state.activeTaskId && nextQueue.includes(state.activeTaskId) ? state.activeTaskId : null;
  const nextActive = candidateActive ?? nextQueue[0] ?? null;

  return {
    ...state,
    queue: nextQueue,
    activeTaskId: nextActive,
    fetchedAt: new Date().toISOString(),
    isReviewSession: false,
    serverExhausted: false,
  } satisfies PracticeSessionState;
}

export function completeTask(state: PracticeSessionState, taskId: string, result?: PracticeResult): PracticeSessionState {
  const remainingQueue = state.queue.filter((id) => id !== taskId);
  const nextQueue = result === 'incorrect' ? appendIfMissing(remainingQueue, taskId) : remainingQueue;
  const nextCompleted =
    result === 'correct' && !state.completed.includes(taskId)
      ? [...state.completed, taskId]
      : state.completed;
  const nextActive = nextQueue[0] ?? null;

  return {
    ...state,
    completed: nextCompleted,
    queue: nextQueue,
    activeTaskId: nextActive,
    recent: buildRecentHistory(state.recent, taskId),
    isReviewSession: false,
    serverExhausted: false,
  } satisfies PracticeSessionState;
}

export function skipTask(state: PracticeSessionState, taskId: string): PracticeSessionState {
  const remainingQueue = state.queue.filter((id) => id !== taskId);
  const nextActive = remainingQueue[0] ?? null;

  return {
    ...state,
    queue: remainingQueue,
    activeTaskId: nextActive,
    recent: buildRecentHistory(state.recent, taskId),
    isReviewSession: false,
  } satisfies PracticeSessionState;
}

export function markServerExhausted(state: PracticeSessionState): PracticeSessionState {
  if (state.serverExhausted) {
    return state;
  }

  return {
    ...state,
    serverExhausted: true,
  } satisfies PracticeSessionState;
}

export const __TEST_ONLY__ = {
  shuffleArray,
};
