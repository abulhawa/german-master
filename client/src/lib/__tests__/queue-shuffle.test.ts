import { describe, expect, it } from 'vitest';

import type { PracticeTask } from '@/lib/tasks';
import { createEmptySessionState } from '@/lib/practice-session/state';
import { enqueueTasks } from '@/lib/practice-session/queue';

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

describe('practice queue shuffle behaviour', () => {
  it('enqueueTasks returns different queue orders across repeated runs most of the time', () => {
    const tasks = Array.from({ length: 10 }, (_, index) => buildTask(`task-${index}`));
    let identicalOrders = 0;

    for (let iteration = 0; iteration < 20; iteration += 1) {
      const first = enqueueTasks(createEmptySessionState(), tasks, { replace: true }).queue.join(',');
      const second = enqueueTasks(createEmptySessionState(), tasks, { replace: true }).queue.join(',');
      if (first === second) {
        identicalOrders += 1;
      }
    }

    expect(identicalOrders).toBeLessThan(4);
  });

  it('does not include duplicate task ids in the random queue', () => {
    const task = buildTask('task-a');
    const result = enqueueTasks(createEmptySessionState(), [task, task], { replace: true });

    expect(result.queue).toEqual(['task-a']);
  });
});
