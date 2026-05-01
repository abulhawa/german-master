/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnsweredQuestionsPanel } from "@/components/answered-questions-panel";
import type { AnsweredQuestion } from "@/lib/answer-history";
import { B2_BERUF_COLLECTION } from "@shared/content-sources";

function createB2BerufEntry(): AnsweredQuestion {
  return {
    id: "entry-b2-beruf",
    taskId: "task-b2-beruf",
    lexemeId: "lexeme-b2-beruf",
    taskType: "vocabulary_drill",
    pos: "noun",
    renderer: "vocabulary_drill",
    result: "correct",
    submittedResponse: "Arbeitsvertrag",
    expectedResponse: "employment contract",
    promptSummary: "Arbeitsvertrag - vocabulary drill",
    answeredAt: "2026-04-28T08:00:00.000Z",
    timeSpentMs: 1000,
    timeSpent: 1000,
    cefrLevel: "B2",
    level: "B2",
    collections: [B2_BERUF_COLLECTION],
    lexeme: {
      id: "lexeme-b2-beruf",
      lemma: "Arbeitsvertrag",
      pos: "noun",
      level: "B2",
      collections: [B2_BERUF_COLLECTION],
      english: "employment contract",
    },
  };
}

describe("AnsweredQuestionsPanel", () => {
  it("labels canonical B2 Beruf vocabulary history by collection instead of raw CEFR fallback", () => {
    render(<AnsweredQuestionsPanel history={[createB2BerufEntry()]} />);

    expect(screen.getByRole("heading", { name: "Arbeitsvertrag" })).toBeInTheDocument();
    expect(screen.getByText("Level B2 Beruf")).toBeInTheDocument();
    expect(screen.queryByText("Level A1")).not.toBeInTheDocument();
  });
});
