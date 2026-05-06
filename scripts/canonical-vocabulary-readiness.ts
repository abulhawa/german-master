import { getPool } from '@db';
import { B2_BERUF_COLLECTION } from '@shared/content-sources';

export type CanonicalVocabularyIssueCode =
  | 'NO_VOCABULARY_TASK_SPECS'
  | 'MISSING_LEXEME_MAPPING'
  | 'MISSING_TASK_LEXEME'
  | 'DUPLICATE_TASK_ID'
  | 'DUPLICATE_LEXEME_TASK_PAIR'
  | 'B2_BERUF_LEVEL_NOT_CANONICAL'
  | 'B2_BERUF_NOT_QUERYABLE';

export interface CanonicalVocabularyReadinessReport {
  vocabularyTaskSpecCount: number;
  b2LexemeCount: number;
  b2BerufLexemeCount: number;
  wordsResolvableToLexemes: number;
  wordsUnresolvableToLexemes: number;
  vocabularyTaskSpecsWithMissingLexemeReferences: number;
  duplicateVocabularyTaskIds: Array<{ taskId: string; count: number }>;
  duplicateVocabularyLexemeTaskPairs: Array<{ lexemeId: string; taskType: string; count: number }>;
  b2BerufVocabularyTaskQueryable: boolean;
  b2BerufLevelMisclassifiedCount: number;
  issues: CanonicalVocabularyIssueCode[];
}

interface ReadinessCounts {
  vocabularyTaskSpecCount: number;
  b2LexemeCount: number;
  b2BerufLexemeCount: number;
  wordsResolvableToLexemes: number;
  wordsUnresolvableToLexemes: number;
  vocabularyTaskSpecsWithMissingLexemeReferences: number;
  b2BerufVocabularyTaskQueryable: boolean;
  b2BerufLevelMisclassifiedCount: number;
}

export function createCanonicalVocabularyReadinessReport(input: {
  counts: ReadinessCounts;
  duplicateVocabularyTaskIds?: Array<{ taskId: string; count: number }>;
  duplicateVocabularyLexemeTaskPairs?: Array<{ lexemeId: string; taskType: string; count: number }>;
}): CanonicalVocabularyReadinessReport {
  const duplicateVocabularyTaskIds = input.duplicateVocabularyTaskIds ?? [];
  const duplicateVocabularyLexemeTaskPairs = input.duplicateVocabularyLexemeTaskPairs ?? [];
  const issues: CanonicalVocabularyIssueCode[] = [];

  if (input.counts.vocabularyTaskSpecCount === 0) {
    issues.push('NO_VOCABULARY_TASK_SPECS');
  }
  if (input.counts.wordsUnresolvableToLexemes > 0) {
    issues.push('MISSING_LEXEME_MAPPING');
  }
  if (input.counts.vocabularyTaskSpecsWithMissingLexemeReferences > 0) {
    issues.push('MISSING_TASK_LEXEME');
  }
  if (duplicateVocabularyTaskIds.length > 0) {
    issues.push('DUPLICATE_TASK_ID');
  }
  if (duplicateVocabularyLexemeTaskPairs.length > 0) {
    issues.push('DUPLICATE_LEXEME_TASK_PAIR');
  }
  if (input.counts.b2BerufLevelMisclassifiedCount > 0) {
    issues.push('B2_BERUF_LEVEL_NOT_CANONICAL');
  }
  if (!input.counts.b2BerufVocabularyTaskQueryable) {
    issues.push('B2_BERUF_NOT_QUERYABLE');
  }

  return {
    ...input.counts,
    duplicateVocabularyTaskIds,
    duplicateVocabularyLexemeTaskPairs,
    issues,
  };
}

export async function inspectCanonicalVocabularyReadiness(): Promise<CanonicalVocabularyReadinessReport> {
  const pool = getPool();

  const countsResult = await pool.query<{
    vocabulary_task_spec_count: string | number;
    b2_lexeme_count: string | number;
    b2_beruf_lexeme_count: string | number;
    words_resolvable_to_lexemes: string | number;
    words_unresolvable_to_lexemes: string | number;
    vocabulary_task_specs_with_missing_lexeme_references: string | number;
    b2_beruf_vocabulary_task_queryable: boolean;
    b2_beruf_level_misclassified_count: string | number;
  }>(
    `
      with word_resolution as (
        select
          w.id,
          l.id as lexeme_id
        from words w
        left join lexemes l
          on lower(l.lemma) = lower(w.lemma)
         and l.pos = w.pos
      )
      select
        (select count(*) from task_specs where task_type = 'vocabulary_drill') as vocabulary_task_spec_count,
        (select count(*) from lexemes where upper(metadata ->> 'level') = 'B2') as b2_lexeme_count,
        (
          select count(*)
          from lexemes
          where upper(coalesce(metadata ->> 'cefrLevel', metadata ->> 'level')) = 'B2'
            and coalesce(metadata -> 'collections', '[]'::jsonb) @> $1::jsonb
        ) as b2_beruf_lexeme_count,
        (select count(*) from word_resolution where lexeme_id is not null) as words_resolvable_to_lexemes,
        (select count(*) from word_resolution where lexeme_id is null) as words_unresolvable_to_lexemes,
        (
          select count(*)
          from task_specs ts
          left join lexemes l on l.id = ts.lexeme_id
          where ts.task_type = 'vocabulary_drill'
            and l.id is null
        ) as vocabulary_task_specs_with_missing_lexeme_references,
        exists (
          select 1
          from task_specs ts
          inner join lexemes l on l.id = ts.lexeme_id
          where ts.task_type = 'vocabulary_drill'
            and upper(coalesce(ts.prompt ->> 'cefrLevel', ts.metadata ->> 'level', l.metadata ->> 'level')) = 'B2'
            and (
              coalesce(l.metadata -> 'collections', '[]'::jsonb) @> $1::jsonb
              or coalesce(ts.prompt -> 'collections', '[]'::jsonb) @> $1::jsonb
              or coalesce(ts.metadata -> 'collections', '[]'::jsonb) @> $1::jsonb
            )
          limit 1
        ) as b2_beruf_vocabulary_task_queryable,
        (
          select count(distinct legacy.lexeme_id)
          from (
            select l.id as lexeme_id
            from lexemes l
            where l.metadata ->> 'level' = 'B2 Beruf'
               or l.metadata ->> 'cefrLevel' = 'B2 Beruf'
            union
            select ts.lexeme_id
            from task_specs ts
            where ts.task_type = 'vocabulary_drill'
              and (
                ts.prompt ->> 'cefrLevel' = 'B2 Beruf'
                or ts.metadata ->> 'level' = 'B2 Beruf'
                or ts.metadata ->> 'cefrLevel' = 'B2 Beruf'
              )
          ) legacy
        ) as b2_beruf_level_misclassified_count
    `,
    [JSON.stringify([B2_BERUF_COLLECTION])],
  );

  const duplicateTaskIdsResult = await pool.query<{ task_id: string; count: string | number }>(
    `
      select task_id, count
      from (
        select id as task_id, count(*) as count
        from task_specs
        where task_type = 'vocabulary_drill'
        group by id
      ) duplicates
      where count > 1
      order by task_id
    `,
  );

  const duplicatePairsResult = await pool.query<{
    lexeme_id: string;
    task_type: string;
    count: string | number;
  }>(
    `
      select lexeme_id, task_type, count
      from (
        select lexeme_id, task_type, count(*) as count
        from task_specs
        where task_type = 'vocabulary_drill'
        group by lexeme_id, task_type
      ) duplicates
      where count > 1
      order by lexeme_id, task_type
    `,
  );

  const counts = countsResult.rows[0];
  if (!counts) {
    throw new Error('Canonical vocabulary readiness query returned no rows');
  }

  return createCanonicalVocabularyReadinessReport({
    counts: {
      vocabularyTaskSpecCount: Number(counts.vocabulary_task_spec_count),
      b2LexemeCount: Number(counts.b2_lexeme_count),
      b2BerufLexemeCount: Number(counts.b2_beruf_lexeme_count),
      wordsResolvableToLexemes: Number(counts.words_resolvable_to_lexemes),
      wordsUnresolvableToLexemes: Number(counts.words_unresolvable_to_lexemes),
      vocabularyTaskSpecsWithMissingLexemeReferences: Number(
        counts.vocabulary_task_specs_with_missing_lexeme_references,
      ),
      b2BerufVocabularyTaskQueryable: Boolean(counts.b2_beruf_vocabulary_task_queryable),
      b2BerufLevelMisclassifiedCount: Number(counts.b2_beruf_level_misclassified_count),
    },
    duplicateVocabularyTaskIds: duplicateTaskIdsResult.rows.map((row) => ({
      taskId: row.task_id,
      count: Number(row.count),
    })),
    duplicateVocabularyLexemeTaskPairs: duplicatePairsResult.rows.map((row) => ({
      lexemeId: row.lexeme_id,
      taskType: row.task_type,
      count: Number(row.count),
    })),
  });
}

function formatReport(report: CanonicalVocabularyReadinessReport): string {
  return JSON.stringify(
    {
      ok: report.issues.length === 0,
      ...report,
    },
    null,
    2,
  );
}

async function main() {
  const report = await inspectCanonicalVocabularyReadiness();
  console.log(formatReport(report));
  if (report.issues.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('canonical-vocabulary-readiness.ts')) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
