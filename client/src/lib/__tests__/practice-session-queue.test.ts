import { describe, expect, it } from 'vitest';

import type { PracticeTask } from '@/lib/tasks';
import { completeTask, enqueueTasks, skipTask } from '@/lib/practice-session';
import { createEmptySessionState, type PracticeSessionState } from '@/lib/practice-session/state';

function buildTask(taskId: string): PracticeTask<'conjugate_form'> {
  return {
    taskId,
    lexemeId: `lex-${taskId}`,
    taskType: 'conjugate_form',
    pos: 'V',
    renderer: 'conjugate_form',
    interactionMode: 'typed',
    prompt: {
      lemma: `lemma-${taskId}`,
      pos: 'V',
      requestedForm: {
        tense: 'present',
        mood: 'indicative',
        person: 1,
        number: 'singular',
      },
      instructions: `Conjugate ${taskId}`,
    },
    expectedSolution: { form: `answer-${taskId}` },
    queueCap: 30,
    lexeme: {
      id: `lex-${taskId}`,
      lemma: `lemma-${taskId}`,
      metadata: { level: 'B1' },
    },
    assignedAt: new Date().toISOString(),
    source: 'seed',
  } satisfies PracticeTask<'conjugate_form'>;
}

function buildSession(queue: string[]): PracticeSessionState {
  return {
    ...createEmptySessionState(),
    activeTaskId: queue[0] ?? null,
    queue,
  } satisfies PracticeSessionState;
}

describe('practice session queue regressions', () => {
  it('does not requeue a correctly completed task', () => {
    const state = buildSession(['task-a']);

    const updated = completeTask(state, 'task-a', 'correct');

    expect(updated.queue).toEqual([]);
    expect(updated.activeTaskId).toBeNull();
    expect(updated.completed).toContain('task-a');
  });

  it('does not re-enqueue recently completed tasks when new tasks arrive', () => {
    const state = buildSession(['task-a', 'task-b']);
    const completed = completeTask(state, 'task-a', 'correct');

    const updated = enqueueTasks(completed, [buildTask('task-a'), buildTask('task-c')]);

    expect(updated.queue).toContain('task-b');
    expect(updated.queue).toContain('task-c');
    expect(updated.queue).not.toContain('task-a');
  });

  it('does not re-enqueue recently skipped tasks when new tasks arrive', () => {
    const state = buildSession(['task-a', 'task-b']);
    const skipped = skipTask(state, 'task-a');

    const updated = enqueueTasks(skipped, [buildTask('task-a'), buildTask('task-c')]);

    expect(updated.queue).toContain('task-b');
    expect(updated.queue).toContain('task-c');
    expect(updated.queue).not.toContain('task-a');
  });

  it('moves failed tasks to the back of the queue', () => {
    const state = buildSession(['task-a', 'task-b']);

    const updated = completeTask(state, 'task-a', 'incorrect');

    expect(updated.queue).toEqual(['task-b', 'task-a']);
    expect(updated.activeTaskId).toBe('task-b');
    expect(updated.completed).not.toContain('task-a');
  });
});
