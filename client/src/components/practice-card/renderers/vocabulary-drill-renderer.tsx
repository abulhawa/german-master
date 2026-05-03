import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Volume2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { submitPracticeAttempt } from '@/lib/api';
import { speak } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/locales';
import type { CEFRLevel, PracticeResult } from '@shared';

import { PracticeCardReviewControls } from '../components/practice-card-review-controls';
import { PracticeCardScaffold } from '../components/practice-card-scaffold';
import { PracticeStatusBadge } from '../components/practice-status-badge';
import type { RendererProps } from '../types';
import {
  createErrorToast,
  createOfflineToast,
  resolveExampleContent,
} from '../utils/data';
import { computeAnsweredAtAndTime, createSubmissionContext } from '../utils/scoring';

function resolveCollectionLabel(collections: readonly string[] | undefined): string {
  if (collections?.includes('b2_beruf')) {
    return 'B2 Beruf';
  }
  return 'Vocabulary';
}

function selfAssessmentFromResult(result: PracticeResult): 'known' | 'forgot' {
  return result === 'correct' ? 'known' : 'forgot';
}

export function VocabularyDrillRenderer({
  task,
  onResult,
  className,
  debugId,
  isLoadingNext,
  sessionProgress,
  onContinue,
  onSkip,
}: RendererProps<'vocabulary_drill'>) {
  const { toast } = useToast();
  const { practiceCard: copy } = useTranslations();
  const vocabularyCopy = copy.vocabulary;
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    setIsAnswerRevealed(false);
    setStatus('idle');
    setIsSubmitting(false);
    startTimeRef.current = Date.now();
  }, [task.taskId]);

  const collectionLabel = resolveCollectionLabel(task.prompt.collections);
  const exampleContent = useMemo(() => resolveExampleContent(task), [task]);
  const answer = task.expectedSolution?.english ?? task.expectedSolution?.answer ?? '';
  const promptSummary = `${task.lexeme.lemma} - ${collectionLabel} vocabulary`;
  const cefrLevel =
    task.prompt.cefrLevel === 'B2'
      ? 'B2'
      : (task.lexeme.metadata?.level as CEFRLevel | undefined);

  const handlePronounce = () => {
    speak(task.lexeme.lemma);
  };

  const handleRevealAnswer = () => {
    setIsAnswerRevealed(true);
  };

  const handleResult = (result: PracticeResult) => {
    if (isSubmitting || status !== 'idle') {
      return;
    }

    const submissionContext = computeAnsweredAtAndTime(
      createSubmissionContext([answer], result),
      startTimeRef.current,
    );
    const payload = {
      taskId: task.taskId,
      lexemeId: task.lexemeId,
      taskType: task.taskType,
      pos: task.pos,
      renderer: task.renderer,
      result,
      submittedResponse: { selfAssessment: selfAssessmentFromResult(result) },
      expectedResponse: task.expectedSolution,
      promptSummary,
      timeSpentMs: submissionContext.timeSpentMs,
      answeredAt: submissionContext.answeredAt,
      cefrLevel,
    } as const;

    setStatus(result);
    setIsSubmitting(true);

    try {
      onResult({
        task,
        result,
        submittedResponse: payload.submittedResponse,
        expectedResponse: task.expectedSolution,
        promptSummary,
        timeSpentMs: submissionContext.timeSpentMs,
        answeredAt: submissionContext.answeredAt,
      });
    } catch {
      // Keep the local card flow responsive even if parent state persistence fails.
    }

    void submitPracticeAttempt(payload)
      .then(({ queued }) => {
        if (queued) {
          createOfflineToast(copy, toast)();
        }
      })
      .catch((error) => {
        const message = error instanceof Error && error.message ? error.message : copy.error.generic;
        createErrorToast(copy, toast, message);
        setStatus('idle');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const promptSection = (
    <>
      <h1 className="sr-only">{task.lexeme.lemma}</h1>
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-primary-foreground/70">
        <span>{collectionLabel}</span>
        <span aria-hidden>&bull;</span>
        <span>{vocabularyCopy.collectionBadge}</span>
      </div>
      <h2 className="max-w-3xl text-4xl font-semibold leading-tight text-primary-foreground sm:text-5xl">
        {task.lexeme.lemma}
      </h2>
      <p className="max-w-3xl text-lg text-primary-foreground/80">{vocabularyCopy.prompt}</p>
    </>
  );

  const statusIndicator = (
    <PracticeStatusBadge
      copy={copy}
      status={status}
      expectedForms={answer ? [answer] : []}
      displayAnswer={answer}
      showAnswer={status !== 'idle'}
    />
  );

  const reviewControls = (
    <PracticeCardReviewControls
      copy={copy}
      status={status}
      canRevealAnswer={false}
      isAnswerRevealed
      onToggleAnswer={handleRevealAnswer}
      onContinue={status !== 'idle' ? onContinue : undefined}
    />
  );

  const answerSection = (
    <div className="flex flex-col items-center gap-5">
      {isAnswerRevealed ? (
        <div className="w-full max-w-2xl rounded-3xl border border-border/40 bg-card/25 px-5 py-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary-foreground/70">
            {vocabularyCopy.answerLabel}
          </p>
          <p className="mt-2 text-2xl font-semibold text-primary-foreground">{answer}</p>
          {exampleContent ? (
            <div className="mt-4 space-y-1 text-sm text-primary-foreground/85">
              <p className="font-medium text-primary-foreground">{exampleContent.de}</p>
              <p>{exampleContent.en}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          className="h-14 w-full max-w-[min(60vw,22rem)] rounded-full text-base shadow-soft shadow-primary/30"
          onClick={handleRevealAnswer}
        >
          {vocabularyCopy.revealAnswer}
        </Button>
      )}

      <div className="flex w-full max-w-[min(72vw,28rem)] flex-col items-center justify-center gap-3 sm:flex-row">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handlePronounce}
          disabled={isSubmitting}
          className="h-12 w-12 rounded-full border border-border/40 bg-card/30 text-primary-foreground transition hover:bg-card/40"
        >
          <Volume2 className="h-5 w-5" aria-hidden />
          <span className="sr-only">{copy.actions.pronounceSrLabel}</span>
        </Button>
        {isAnswerRevealed && status === 'idle' ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 flex-1 rounded-full border-border/70 bg-card/90 text-base"
              onClick={() => handleResult('incorrect')}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
              {vocabularyCopy.incorrect}
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-12 flex-1 rounded-full text-base"
              onClick={() => handleResult('correct')}
              disabled={isSubmitting}
            >
              <Check className="h-4 w-4" aria-hidden />
              {vocabularyCopy.correct}
            </Button>
          </>
        ) : null}
      </div>

      {reviewControls}
      {onSkip && status === 'idle' ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 w-full max-w-[min(60vw,20rem)] rounded-full border-border/70 bg-card/90 text-base"
          onClick={onSkip}
          disabled={isSubmitting}
        >
          {copy.actions.skip}
        </Button>
      ) : null}
    </div>
  );

  return (
    <PracticeCardScaffold
      copy={copy}
      sessionProgress={sessionProgress}
      prompt={promptSection}
      answerSection={answerSection}
      statusBadge={status === 'idle' ? null : statusIndicator}
      className={className}
      debugId={debugId}
      isLoadingNext={isLoadingNext}
      badgeLabel={vocabularyCopy.badgeLabel}
    />
  );
}
