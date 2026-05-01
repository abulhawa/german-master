/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnsweredQuestion } from "@/lib/answer-history";

const mocks = vi.hoisted(() => ({
  authSession: {
    data: null as null | { user: { id: string } },
  },
  localHistory: [] as AnsweredQuestion[],
  fetchPracticeHistory: vi.fn(),
  clearPracticeHistory: vi.fn(),
  saveAnswerHistory: vi.fn(),
}));

vi.mock("@/auth/session", () => ({
  useAuthSession: () => mocks.authSession,
}));

vi.mock("@/lib/api", () => ({
  fetchPracticeHistory: mocks.fetchPracticeHistory,
  clearPracticeHistory: mocks.clearPracticeHistory,
}));

vi.mock("@/lib/device", () => ({
  getDeviceId: () => "device-123",
}));

vi.mock("@/lib/answer-history", () => ({
  loadAnswerHistory: () => mocks.localHistory,
  saveAnswerHistory: mocks.saveAnswerHistory,
}));

const { useAnswerHistory } = await import("./use-answer-history");

function createHistoryEntry(id: string, answeredAt: string): AnsweredQuestion {
  return {
    id,
    taskId: `task-${id}`,
    lexemeId: `lexeme-${id}`,
    taskType: "conjugate_form",
    pos: "verb",
    renderer: "conjugate-form",
    result: "correct",
    submittedResponse: "ging",
    expectedResponse: "ging",
    promptSummary: "gehen - Praeteritum",
    answeredAt,
    timeSpentMs: 1000,
    timeSpent: 1000,
    cefrLevel: "A1",
    level: "A1",
    lexeme: {
      id: `lexeme-${id}`,
      lemma: "gehen",
      pos: "verb",
      level: "A1",
    },
  };
}

describe("useAnswerHistory", () => {
  beforeEach(() => {
    mocks.authSession.data = null;
    mocks.localHistory = [];
    mocks.fetchPracticeHistory.mockReset();
    mocks.clearPracticeHistory.mockReset();
    mocks.saveAnswerHistory.mockReset();
  });

  it("merges device history with local history when signed out", async () => {
    mocks.localHistory = [
      createHistoryEntry("local", "2026-04-28T08:00:00.000Z"),
    ];
    mocks.fetchPracticeHistory.mockResolvedValue([
      createHistoryEntry("remote", "2026-04-28T09:00:00.000Z"),
    ]);

    const { result } = renderHook(() => useAnswerHistory());

    await waitFor(() => {
      expect(result.current.history.map((entry) => entry.id)).toEqual(["remote", "local"]);
    });
  });

  it("uses synced user history as canonical when signed in", async () => {
    mocks.authSession.data = { user: { id: "user-123" } };
    mocks.localHistory = [
      createHistoryEntry("stale-local", "2026-04-28T08:00:00.000Z"),
    ];
    mocks.fetchPracticeHistory.mockResolvedValue([
      createHistoryEntry("user-table", "2026-04-28T09:00:00.000Z"),
    ]);

    const { result } = renderHook(() => useAnswerHistory());

    await waitFor(() => {
      expect(result.current.history.map((entry) => entry.id)).toEqual(["user-table"]);
    });
  });

  it("requests the Android-aligned recent history window", async () => {
    mocks.fetchPracticeHistory.mockResolvedValue([]);

    renderHook(() => useAnswerHistory());

    await waitFor(() => {
      expect(mocks.fetchPracticeHistory).toHaveBeenCalledWith({
        deviceId: "device-123",
        limit: 500,
      });
    });
  });
});
