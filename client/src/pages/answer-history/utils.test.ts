import { describe, expect, it } from "vitest";

import type { AnsweredQuestion } from "@/lib/answer-history";
import { B2_BERUF_COLLECTION } from "@shared/content-sources";

import { LEVEL_FILTERS, answerMatchesLevelFilter } from "./utils";

function createHistoryEntry(level: string): AnsweredQuestion {
  return {
    id: `entry-${level}`,
    taskId: `task-${level}`,
    lexemeId: `lexeme-${level}`,
    taskType: "conjugate_form",
    pos: "V",
    renderer: "conjugate-form",
    result: "correct",
    submittedResponse: "ging",
    expectedResponse: "ging",
    promptSummary: "gehen - Praeteritum",
    answeredAt: "2026-04-28T08:00:00.000Z",
    timeSpentMs: 1000,
    timeSpent: 1000,
    cefrLevel: level as AnsweredQuestion["cefrLevel"],
    level: level as AnsweredQuestion["level"],
    lexeme: {
      id: `lexeme-${level}`,
      lemma: "gehen",
      pos: "V",
      level: level as NonNullable<AnsweredQuestion["lexeme"]>["level"],
    },
  };
}

describe("answer history level filters", () => {
  it("exposes B2 Beruf as a dedicated history filter", () => {
    expect(LEVEL_FILTERS).toContain("B2 Beruf");
  });

  it("matches B2 Beruf history entries without folding them into B2", () => {
    const berufEntry = createHistoryEntry("B2 Beruf");
    const b2Entry = createHistoryEntry("B2");

    expect(answerMatchesLevelFilter(berufEntry, "B2 Beruf")).toBe(true);
    expect(answerMatchesLevelFilter(berufEntry, "B2")).toBe(false);
    expect(answerMatchesLevelFilter(b2Entry, "B2 Beruf")).toBe(false);
  });

  it("matches canonical B2 vocabulary entries with the B2 Beruf collection", () => {
    const berufEntry = createHistoryEntry("B2");
    berufEntry.taskType = "vocabulary_drill";
    berufEntry.collections = [B2_BERUF_COLLECTION];
    berufEntry.lexeme = {
      ...berufEntry.lexeme!,
      level: "B2",
      collections: [B2_BERUF_COLLECTION],
    };

    expect(answerMatchesLevelFilter(berufEntry, "B2 Beruf")).toBe(true);
    expect(answerMatchesLevelFilter(berufEntry, "B2")).toBe(false);
    expect(answerMatchesLevelFilter(berufEntry, "A1")).toBe(false);
  });
});
