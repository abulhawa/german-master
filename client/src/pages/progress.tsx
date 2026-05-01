import { useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, BarChart3, BookOpen, History, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { MobileNavBar } from "@/components/layout/mobile-nav-bar";
import { getPrimaryNavigationItems } from "@/components/layout/navigation";
import { SidebarNavButton } from "@/components/layout/sidebar-nav-button";
import { AnsweredQuestionsPanel } from "@/components/answered-questions-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthSession } from "@/auth/session";
import { getAnswerHistoryFilterLevels, type AnsweredQuestion } from "@/lib/answer-history";
import { loadPracticeProgress } from "@/lib/practice-progress";
import { computePracticeSummary } from "@/lib/practice-overview";
import { getProgressTaskTypeLabel } from "@/lib/task-metadata";
import { useFeatureCapabilities } from "@/lib/features";
import type { TaskType } from "@shared";

import { FilterControls } from "./answer-history/components/filter-controls";
import { SummaryCards } from "./answer-history/components/summary-cards";
import { useAnswerHistory } from "./answer-history/hooks/use-answer-history";
import { answerMatchesLevelFilter, formatAverageDuration } from "./answer-history/utils";

type ProgressLegacySource = "answers" | "analytics";

interface ProgressPageProps {
  legacySource?: ProgressLegacySource;
}

const PROGRESS_IDS = {
  page: "progress-page",
  content: "progress-content",
  headerSection: "progress-header",
  statsSection: "progress-stats",
  filtersSection: "progress-filters",
  taskTypesSection: "progress-task-types",
  panelSection: "progress-panel",
  retryButton: "progress-retry-button",
} as const;

const VISIBLE_PROGRESS_TASK_TYPES = [
  "vocabulary_drill",
  "conjugate_form",
  "noun_case_declension",
  "adj_ending",
] satisfies TaskType[];

function isProgressHistoryEntry(entry: AnsweredQuestion): boolean {
  return (VISIBLE_PROGRESS_TASK_TYPES as readonly TaskType[]).includes(entry.taskType);
}

function computeHistoryStats(history: AnsweredQuestion[]) {
  const totalAnswers = history.length;
  const totalCorrect = history.filter((item) => item.result === "correct").length;
  const totalIncorrect = totalAnswers - totalCorrect;
  const accuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;
  const totalTimeMs = history.reduce(
    (sum, item) => sum + (typeof item.timeSpent === "number" ? item.timeSpent : item.timeSpentMs ?? 0),
    0,
  );

  return {
    totalAnswers,
    totalCorrect,
    totalIncorrect,
    accuracy,
    formattedAverageTime: formatAverageDuration(totalAnswers > 0 ? Math.round(totalTimeMs / totalAnswers) : 0),
  };
}

function buildTaskTypeBreakdown(history: AnsweredQuestion[]) {
  return VISIBLE_PROGRESS_TASK_TYPES.map((taskType) => {
    const entries = history.filter((item) => item.taskType === taskType);
    const correct = entries.filter((item) => item.result === "correct").length;
    const berufCount = entries.filter((item) => getAnswerHistoryFilterLevels(item).includes("B2 Beruf")).length;
    const total = entries.length;

    return {
      taskType,
      label: getProgressTaskTypeLabel(taskType),
      total,
      correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      berufCount,
    };
  });
}

function TaskTypeSummary({ history }: { history: AnsweredQuestion[] }) {
  const breakdown = useMemo(() => buildTaskTypeBreakdown(history), [history]);
  const progress = useMemo(() => loadPracticeProgress(), []);
  const localSummary = useMemo(
    () => computePracticeSummary(progress, [...VISIBLE_PROGRESS_TASK_TYPES]),
    [progress],
  );

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.35fr)]" id={PROGRESS_IDS.taskTypesSection}>
      <Card className="rounded-3xl border-border/60 bg-card/85 shadow-soft shadow-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden />
            Practice types
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pt-0 sm:grid-cols-2 xl:grid-cols-4">
          {breakdown.map((item) => (
            <div key={item.taskType} className="rounded-2xl border border-border/60 bg-background/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="break-words text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
                  {item.label}
                </p>
                {item.berufCount > 0 ? (
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    B2 Beruf
                  </Badge>
                ) : null}
              </div>
              <p className="mt-4 text-2xl font-semibold text-foreground">{item.total}</p>
              <p className="text-xs text-muted-foreground">
                {item.total > 0
                  ? `${item.correct} correct - ${item.accuracy}% accuracy`
                  : "No attempts yet"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border/60 bg-card/85 shadow-soft shadow-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
            Local streak
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <p className="text-3xl font-semibold text-foreground">{localSummary.streak}</p>
          <p className="text-sm text-muted-foreground">
            Based on this device's saved vocabulary and grammar progress.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function LegacyNotice({ source }: { source: ProgressLegacySource }) {
  const title =
    source === "answers"
      ? "Answer history now lives in Progress"
      : "Analytics now lives in Progress";

  return (
    <Alert className="rounded-2xl border-border/60 bg-background/80">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>This compatibility page shows the unified Progress view.</span>
        <Link href="/progress" className="text-sm font-semibold text-primary">
          Open /progress
        </Link>
      </AlertDescription>
    </Alert>
  );
}

export function ProgressPage({ legacySource }: ProgressPageProps) {
  const {
    history,
    levelFilter,
    setLevelFilter,
    resultFilter,
    setResultFilter,
    resetFilters,
    activeFilters,
    hasActiveFilters,
    isLoading,
    loadError,
    retryLoad,
    levelOptions,
    resultOptions,
  } = useAnswerHistory({ pageSize: 150 });

  const { data: authSession } = useAuthSession();
  const features = useFeatureCapabilities();
  const navigationItems = useMemo(
    () => getPrimaryNavigationItems(authSession?.user.role ?? null, features),
    [authSession?.user.role, features],
  );

  const visibleHistory = useMemo(() => history.filter(isProgressHistoryEntry), [history]);
  const filteredVisibleHistory = useMemo(
    () =>
      visibleHistory.filter((item) => {
        const matchesLevel = answerMatchesLevelFilter(item, levelFilter);
        const matchesResult = resultFilter === "all" || item.result === resultFilter;
        return matchesLevel && matchesResult;
      }),
    [levelFilter, resultFilter, visibleHistory],
  );
  const recentHistory = useMemo(() => filteredVisibleHistory.slice(0, 25), [filteredVisibleHistory]);
  const stats = useMemo(() => computeHistoryStats(visibleHistory), [visibleHistory]);

  const sidebar = (
    <div className="flex h-full flex-col justify-between gap-8">
      <div className="space-y-6">
        <div className="grid gap-2">
          {navigationItems.map((item) => (
            <SidebarNavButton
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              exact={item.exact}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div id={PROGRESS_IDS.page}>
      <AppShell sidebar={sidebar} mobileNav={<MobileNavBar items={navigationItems} />}>
        <div className="space-y-6" id={PROGRESS_IDS.content}>
          <section
            className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-card/85 p-6 shadow-soft shadow-primary/5 sm:flex-row sm:items-center sm:justify-between"
            id={PROGRESS_IDS.headerSection}
          >
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Practice history
              </p>
              <h1 className="inline-flex items-center gap-2 text-2xl font-semibold text-foreground">
                <History className="h-6 w-6 text-primary" aria-hidden />
                Progress
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Review recent vocabulary and grammar attempts, including synced practice when available.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link href="/">
                <Button variant="secondary" className="rounded-2xl px-5">
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                  Back to practice
                </Button>
              </Link>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl px-5"
                onClick={retryLoad}
                disabled={isLoading}
                id={PROGRESS_IDS.retryButton}
              >
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                Refresh
              </Button>
            </div>
          </section>

          {legacySource ? <LegacyNotice source={legacySource} /> : null}

          <SummaryCards
            sectionId={PROGRESS_IDS.statsSection}
            totalAnswers={stats.totalAnswers}
            totalCorrect={stats.totalCorrect}
            totalIncorrect={stats.totalIncorrect}
            accuracy={stats.accuracy}
            formattedAverageTime={stats.formattedAverageTime}
            isLoading={isLoading}
            showSkeletonStats={isLoading && stats.totalAnswers === 0}
          />

          <TaskTypeSummary history={visibleHistory} />

          <FilterControls
            sectionId={PROGRESS_IDS.filtersSection}
            levelOptions={levelOptions}
            resultOptions={resultOptions}
            selectedLevel={levelFilter}
            selectedResult={resultFilter}
            onLevelChange={setLevelFilter}
            onResultChange={setResultFilter}
            onResetFilters={resetFilters}
            activeFilters={activeFilters}
            hasActiveFilters={hasActiveFilters}
          />

          {loadError ? (
            <Alert variant="destructive" className="rounded-3xl border border-destructive/40 bg-destructive/10">
              <AlertTitle>Unable to refresh progress</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-4" id={PROGRESS_IDS.panelSection}>
            <AnsweredQuestionsPanel
              history={recentHistory}
              title="Recent attempts"
              description="Vocabulary and grammar practice attempts are grouped here so you can review what happened across web and synced sessions."
              emptyStateMessage="Vocabulary and grammar attempts will appear here once you start practicing."
              debugId="progress-recent-attempts"
            />
          </div>
        </div>
      </AppShell>
    </div>
  );
}

export default function ProgressRoutePage() {
  return <ProgressPage />;
}
