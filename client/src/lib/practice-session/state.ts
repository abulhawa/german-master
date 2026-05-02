export interface PracticeSessionState {
  version: number;
  activeTaskId: string | null;
  queue: string[];
  completed: string[];
  fetchedAt: string | null;
  recent: string[];
  isReviewSession: boolean;
  serverExhausted: boolean;
}

export const CURRENT_SESSION_STATE_VERSION = 4;
export const MAX_RECENT_HISTORY = 35;

export function createEmptySessionState(): PracticeSessionState {
  return {
    version: CURRENT_SESSION_STATE_VERSION,
    activeTaskId: null,
    queue: [],
    completed: [],
    fetchedAt: null,
    recent: [],
    isReviewSession: false,
    serverExhausted: false,
  } satisfies PracticeSessionState;
}

export function clearSessionQueue(
  state: PracticeSessionState,
  { preserveCompleted = false }: { preserveCompleted?: boolean } = {},
): PracticeSessionState {
  return {
    ...state,
    queue: [],
    activeTaskId: null,
    fetchedAt: null,
    completed: preserveCompleted ? state.completed : [],
    isReviewSession: false,
    serverExhausted: false,
  } satisfies PracticeSessionState;
}
