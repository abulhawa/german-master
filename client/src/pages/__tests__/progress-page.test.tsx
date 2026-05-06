/* @vitest-environment jsdom */

import type { ReactNode } from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskAnswerHistoryItem } from "@/lib/answer-history";
import { B2_BERUF_COLLECTION } from "@shared/content-sources";

const mocks = vi.hoisted(() => ({
  fetchPracticeHistory: vi.fn(),
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/layout/mobile-nav-bar", () => ({
  MobileNavBar: () => <nav aria-label="Mobile navigation" />,
}));

vi.mock("@/components/layout/sidebar-nav-button", () => ({
  SidebarNavButton: ({ label }: { label: string }) => <span>{label}</span>,
}));

vi.mock("@/auth/session", () => ({
  useAuthSession: () => ({
    data: null,
    status: "success",
    isLoading: false,
    isFetching: false,
  }),
}));

vi.mock("@/lib/device", () => ({
  getDeviceId: () => "test-device-id",
}));

vi.mock("@/lib/api", () => ({
  fetchPracticeHistory: mocks.fetchPracticeHistory,
  clearPracticeHistory: vi.fn(),
}));

const { ProgressPage } = await import("@/pages/progress");
const { default: AnswerHistoryPage } = await import("@/pages/answer-history");
const { default: AnalyticsPage } = await import("@/pages/analytics");

function createHistoryEntry(
  overrides: Partial<TaskAnswerHistoryItem> & Pick<TaskAnswerHistoryItem, "id" | "taskType" | "pos" | "promptSummary">,
): TaskAnswerHistoryItem {
  const taskType = overrides.taskType;
  const lemma = overrides.lexeme?.lemma ?? overrides.promptSummary.split(" - ")[0] ?? "gehen";

  return {
    taskId: `${overrides.id}:task`,
    lexemeId: `${overrides.id}:lexeme`,
    renderer: taskType === "vocabulary_drill" ? "word_card" : taskType,
    result: "correct",
    submittedResponse: "answer",
    expectedResponse: "answer",
    answeredAt: "2026-04-28T08:00:00.000Z",
    timeSpentMs: 1000,
    timeSpent: 1000,
    cefrLevel: "B2",
    level: "B2",
    attemptedAnswer: "answer",
    correctAnswer: "answer",
    prompt: overrides.promptSummary,
    lexeme: {
      id: `${overrides.id}:lexeme`,
      lemma,
      pos: overrides.pos,
      level: "B2",
    },
    ...overrides,
  };
}

function createProgressHistory(): TaskAnswerHistoryItem[] {
  return [
    createHistoryEntry({
      id: "vocabulary",
      taskId: "word_123:vocabulary_drill",
      lexemeId: "word_123",
      taskType: "vocabulary_drill",
      pos: "N",
      renderer: "word_card",
      promptSummary: "Arbeitsvertrag - vocabulary drill",
      collections: [B2_BERUF_COLLECTION],
      lexeme: {
        id: "word_123",
        lemma: "Arbeitsvertrag",
        pos: "N",
        level: "B2",
        collections: [B2_BERUF_COLLECTION],
        english: "employment contract",
      },
    }),
    createHistoryEntry({
      id: "verb",
      taskType: "conjugate_form",
      pos: "V",
      promptSummary: "gehen - past tense",
      lexeme: {
        id: "lexeme-gehen",
        lemma: "gehen",
        pos: "V",
        level: "A2",
        english: "to go",
      },
    }),
    createHistoryEntry({
      id: "noun",
      taskType: "noun_case_declension",
      pos: "N",
      promptSummary: "Haus - dative singular",
      lexeme: {
        id: "lexeme-haus",
        lemma: "Haus",
        pos: "N",
        level: "A1",
        english: "house",
      },
    }),
    createHistoryEntry({
      id: "adjective",
      taskType: "adj_ending",
      pos: "Adj",
      promptSummary: "schnell - comparative",
      lexeme: {
        id: "lexeme-schnell",
        lemma: "schnell",
        pos: "Adj",
        level: "A1",
        english: "fast",
      },
    }),
    createHistoryEntry({
      id: "writing",
      taskType: "b2_writing_prompt",
      pos: "V",
      promptSummary: "Writing Lab prompt",
      lexeme: {
        id: "lexeme-writing",
        lemma: "Writing Lab",
        pos: "V",
        level: "B2",
      },
    }),
  ];
}

function createPagedProgressHistory(count: number, startAt = 1): TaskAnswerHistoryItem[] {
  return Array.from({ length: count }, (_, index) =>
    createHistoryEntry({
      id: `paged-${startAt + index}`,
      taskType: "vocabulary_drill",
      pos: "N",
      promptSummary: `Wort ${startAt + index} - vocabulary drill`,
      lexeme: {
        id: `lexeme-paged-${startAt + index}`,
        lemma: `Wort ${startAt + index}`,
        pos: "N",
        level: "B2",
      },
    }),
  );
}

describe("ProgressPage", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.fetchPracticeHistory.mockReset();
    mocks.fetchPracticeHistory.mockResolvedValue(createProgressHistory());
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the unified progress page with vocabulary and grammar attempts", async () => {
    render(<ProgressPage />);

    expect(screen.getByRole("heading", { name: "Progress", level: 1 })).toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: "Arbeitsvertrag" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "gehen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Haus" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "schnell" })).toBeInTheDocument();
    expect(screen.getAllByText("Wortschatz").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Verb conjugation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Noun declension").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Adjective endings").length).toBeGreaterThan(0);
  });

  it("uses canonical B2 Beruf vocabulary labels without showing legacy word ids", async () => {
    render(<ProgressPage />);

    expect(await screen.findByRole("heading", { name: "Arbeitsvertrag" })).toBeInTheDocument();
    expect(screen.getAllByText("B2 Beruf").length).toBeGreaterThan(0);
    expect(screen.getByText("Collection B2 Beruf")).toBeInTheDocument();
    expect(screen.queryByText("Level B2 Beruf")).not.toBeInTheDocument();
    expect(screen.queryByText("word_123")).not.toBeInTheDocument();
  });

  it("keeps Writing Lab attempts hidden from Progress", async () => {
    render(<ProgressPage />);

    await screen.findByRole("heading", { name: "Arbeitsvertrag" });

    expect(screen.queryByText(/Writing Lab/i)).not.toBeInTheDocument();
    expect(screen.queryByText("writing_lab")).not.toBeInTheDocument();
  });

  it("keeps /answers working as a compatibility view", async () => {
    render(<AnswerHistoryPage />);

    expect(await screen.findByText("Answer history now lives in Progress")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Progress", level: 1 })).toBeInTheDocument();
  });

  it("keeps /analytics working as a compatibility view", async () => {
    render(<AnalyticsPage />);

    expect(await screen.findByText("Analytics now lives in Progress")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Progress", level: 1 })).toBeInTheDocument();
  });

  it("loads history through the existing practice history read API", async () => {
    render(<ProgressPage />);

    await waitFor(() => {
      expect(mocks.fetchPracticeHistory).toHaveBeenCalledWith({
        deviceId: "test-device-id",
        limit: 500,
      });
    });
  });

  it("loads additional history pages when the first remote page is full", async () => {
    mocks.fetchPracticeHistory
      .mockResolvedValueOnce(createPagedProgressHistory(500))
      .mockResolvedValueOnce(createPagedProgressHistory(1, 501));

    render(<ProgressPage />);

    await waitFor(() => {
      expect(mocks.fetchPracticeHistory).toHaveBeenCalledTimes(2);
    });
    expect(mocks.fetchPracticeHistory).toHaveBeenNthCalledWith(1, {
      deviceId: "test-device-id",
      limit: 500,
    });
    expect(mocks.fetchPracticeHistory).toHaveBeenNthCalledWith(2, {
      deviceId: "test-device-id",
      limit: 500,
      offset: 500,
    });
    expect(screen.getAllByText("501").length).toBeGreaterThan(0);
  });
});
