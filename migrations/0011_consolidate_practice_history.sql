-- 1. Add new columns to practice_history
ALTER TABLE "practice_history" ADD COLUMN "lemma" text;
ALTER TABLE "practice_history" ADD COLUMN "submitted_answer" text;
ALTER TABLE "practice_history" ADD COLUMN "correct_answer" text;

-- 2. Backfill existing records in practice_history from metadata
UPDATE "practice_history"
SET
  "submitted_answer" = COALESCE("submitted_answer", "metadata"->>'submittedResponse'),
  "correct_answer" = COALESCE("correct_answer", "metadata"->>'expectedResponse')
WHERE "metadata" IS NOT NULL;

-- 3. Migrate data from user_practice_history to practice_history
-- This handles any data that hasn't been backfilled yet by the old migration
INSERT INTO "practice_history" (
  "task_id",
  "lexeme_id",
  "lemma",
  "pos",
  "task_type",
  "renderer",
  "device_id",
  "user_id",
  "result",
  "submitted_answer",
  "correct_answer",
  "response_ms",
  "submitted_at",
  "answered_at",
  "cefr_level",
  "hints_used",
  "metadata"
)
SELECT
  mobile."task_id",
  mobile."lexeme_id",
  mobile."lemma",
  mobile."pos",
  mobile."task_type",
  mobile."renderer",
  mobile."device_id",
  mobile."user_id"::text,
  mobile."result"::practice_result,
  mobile."submitted_answer",
  mobile."correct_answer",
  mobile."response_ms",
  mobile."submitted_at",
  mobile."submitted_at",
  mobile."cefr_level",
  mobile."hints_used",
  jsonb_build_object(
    'submittedResponse', mobile."submitted_answer",
    'expectedResponse', mobile."correct_answer",
    'backfilledFrom', 'user_practice_history_final'
  )
FROM "user_practice_history" mobile
INNER JOIN "task_specs" tasks ON tasks."id" = mobile."task_id"
INNER JOIN "lexemes" lexemes ON lexemes."id" = mobile."lexeme_id"
LEFT JOIN "practice_history" existing
  ON existing."user_id" = mobile."user_id"::text
  AND existing."task_id" = mobile."task_id"
  AND existing."device_id" = mobile."device_id"
  AND existing."submitted_at" = mobile."submitted_at"
WHERE existing."id" IS NULL;

-- 4. Drop the old table
DROP TABLE "user_practice_history";

-- 5. Add index on user_id for practice_history
CREATE INDEX IF NOT EXISTS "practice_history_user_idx" ON "practice_history" USING btree ("user_id");
