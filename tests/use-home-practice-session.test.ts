import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useHomePracticeSession } from '@/pages/home/use-practice-session';
import type { PracticeCardResult } from '@/components/practice-card';
import type { PracticeTask } from '@/lib/tasks';

interface RawTaskPayload {
  taskId: string;
  taskType: 'conjugate_form';
  renderer: 'conjugate_form';
  pos: 'verb';
  prompt: {
    lemma: string;
    pos: 'verb';
    requestedForm: {
      tense: 'present';
      person: number;
      number: 'singular' | 'plural';
    };
    instructions: string;
  };
  solution: {
    form: string;
  };
  queueCap: number;
  lexeme: {
    id: string;
    lemma: string;
    metadata: Record<string, unknown>;
  };
}

function createRawTask(index: number): RawTaskPayload {
  return {
    taskId: `task-${index}`,
    taskType: 'conjugate_form',
    renderer: 'conjugate_form',
    pos: 'verb',
    prompt: {
      lemma: `verb-${index}`,
      pos: 'verb',
      requestedForm: {
        tense: 'present',
        person: 1,
        number: 'singular',
      },
      instructions: `Conjugate verb-${index}`,
    },
    solution: {
      form: `form-${index}`,
    },
    queueCap: 30,
    lexeme: {
      id: `lex-${index}`,
      lemma: `verb-${index}`,
      metadata: { level: 'A1' },
    },
  } satisfies RawTaskPayload;
}

function createJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useHomePracticeSession', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('fetches a new random queue once the current queue is completed', async () => {
    const initialTasks = Array.from({ length: 6 }, (_, index) => createRawTask(index + 1));
    const nextTasks = Array.from({ length: 3 }, (_, index) => createRawTask(index + 101));

    let fetchCall = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const payload =
        fetchCall === 0
          ? { tasksByType: { conjugate_form: initialTasks } }
          : { tasksByType: { conjugate_form: nextTasks } };
      fetchCall += 1;
      return Promise.resolve(createJsonResponse(payload));
    });

    const { result } = renderHook(() =>
      useHomePracticeSession({
        activeTaskTypes: ['conjugate_form'],
        sessionScopeKey: 'spec-scope',
        userId: 'user-1',
        resolveLevelForPos: () => 'A1',
      }),
    );

    await waitFor(() => {
      expect(result.current.activeTask).toBeDefined();
    });

    for (let iteration = 0; iteration < initialTasks.length; iteration += 1) {
      await waitFor(() => {
        expect(result.current.activeTask).toBeDefined();
      });
      const active = result.current.activeTask as PracticeTask | undefined;
      expect(active).toBeDefined();
      if (!active) {
        break;
      }

      act(() => {
        const attempt: PracticeCardResult = {
          task: active,
          result: 'correct',
          submittedResponse: null,
          expectedResponse: active.expectedSolution,
          promptSummary: `Answered ${active.taskId}`,
          timeSpentMs: 500,
          answeredAt: new Date().toISOString(),
        };
        result.current.registerPendingResult(attempt);
      });

      act(() => {
        result.current.continueToNext();
      });
    }

    await waitFor(() => {
      expect(fetchCall).toBeGreaterThanOrEqual(2);
      const queue = result.current.session.queue;
      const queueSet = new Set(queue);
      for (const task of nextTasks) {
        expect(queueSet.has(task.taskId)).toBe(true);
      }
      for (const task of initialTasks) {
        expect(queueSet.has(task.taskId)).toBe(false);
      }
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  it('starts a fresh shuffled cycle when exclusions exhaust the available tasks', async () => {
    const task = createRawTask(1);

    let fetchCall = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const payload =
        fetchCall === 0
          ? { tasksByType: { conjugate_form: [task] } }
          : fetchCall === 1
          ? { tasksByType: { conjugate_form: [] } }
          : { tasksByType: { conjugate_form: [task] } };
      fetchCall += 1;
      return Promise.resolve(createJsonResponse(payload));
    });

    const { result } = renderHook(() =>
      useHomePracticeSession({
        activeTaskTypes: ['conjugate_form'],
        sessionScopeKey: 'cycle-scope',
        userId: 'user-1',
        resolveLevelForPos: () => 'A1',
      }),
    );

    await waitFor(() => {
      expect(result.current.activeTask).toBeDefined();
    });

    const active = result.current.activeTask as PracticeTask;
    act(() => {
      result.current.registerPendingResult({
        task: active,
        result: 'correct',
        submittedResponse: null,
        expectedResponse: active.expectedSolution,
        promptSummary: `Answered ${active.taskId}`,
        timeSpentMs: 500,
        answeredAt: new Date().toISOString(),
      });
    });

    act(() => {
      result.current.continueToNext();
    });

    await waitFor(() => {
      expect(fetchCall).toBeGreaterThanOrEqual(3);
      expect(result.current.activeTask?.taskId).toBe(task.taskId);
      expect(result.current.session.completed).toHaveLength(0);
    });

    expect(fetchMock.mock.calls[1]?.[0].toString()).toContain('excludeTaskIds=task-1');
    expect(fetchMock.mock.calls[2]?.[0].toString()).not.toContain('excludeTaskIds=');
  });

  it('replaces a fully skipped batch instead of looping the same tasks', async () => {
    const initialTasks = Array.from({ length: 4 }, (_, index) => createRawTask(index + 1));
    const nextTasks = Array.from({ length: 6 }, (_, index) => createRawTask(index + 101));
    const initialTaskIds = new Set(initialTasks.map((task) => task.taskId));

    let fetchCall = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const payload =
        fetchCall === 0
          ? { tasksByType: { conjugate_form: initialTasks } }
          : { tasksByType: { conjugate_form: nextTasks } };
      fetchCall += 1;
      return Promise.resolve(createJsonResponse(payload));
    });

    const { result } = renderHook(() =>
      useHomePracticeSession({
        activeTaskTypes: ['conjugate_form'],
        sessionScopeKey: 'skip-scope',
        userId: 'user-1',
        resolveLevelForPos: () => 'A1',
      }),
    );

    await waitFor(() => {
      expect(result.current.activeTask).toBeDefined();
    });

    for (let iteration = 0; iteration < initialTasks.length; iteration += 1) {
      await waitFor(() => {
        expect(result.current.activeTask).toBeDefined();
      });

      const activeTaskId = result.current.activeTask?.taskId;
      expect(activeTaskId).toBeTruthy();
      if (!activeTaskId) {
        break;
      }

      act(() => {
        result.current.skipActiveTask();
      });

      if (iteration < initialTasks.length - 1) {
        await waitFor(() => {
          expect(result.current.activeTask?.taskId).not.toBe(activeTaskId);
        });
      }
    }

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.current.activeTask).toBeDefined();
      expect(initialTaskIds.has(result.current.activeTask!.taskId)).toBe(false);
    });

    const queueSet = new Set(result.current.session.queue);
    for (const task of nextTasks) {
      expect(queueSet.has(task.taskId)).toBe(true);
    }
    for (const task of initialTasks) {
      expect(queueSet.has(task.taskId)).toBe(false);
    }
    expect(result.current.session.completed).toHaveLength(0);
  });
});
