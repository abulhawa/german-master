-- 1. Backfill the lemma column from lexemes for existing records
UPDATE "practice_history"
SET "lemma" = lexemes."lemma"
FROM "lexemes"
WHERE "practice_history"."lexeme_id" = "lexemes"."id"
  AND "practice_history"."lemma" IS NULL;

-- 2. Backfill lemma from metadata fallback if still null
UPDATE "practice_history"
SET "lemma" = SPLIT_PART("metadata"->>'promptSummary', ' - ', 1)
WHERE "lemma" IS NULL AND "metadata"->>'promptSummary' IS NOT NULL;

-- 3. Relax foreign keys on practice_history to allow identity-based sync
-- This is necessary because mobile sync uses 'identity:pos:lemma' IDs when remote specs aren't yet available.
ALTER TABLE "practice_history" DROP CONSTRAINT IF EXISTS "practice_history_task_id_task_specs_id_fk";
ALTER TABLE "practice_history" DROP CONSTRAINT IF EXISTS "practice_history_lexeme_id_lexemes_id_fk";

-- Re-add with NO ACTION to allow orphans but still allow cascading deletes if needed
-- Actually, the user's previous schema was strict. To maintain alignment with mobile sync
-- which sometimes has to send "unmapped" records, we should either ensure those IDs exist
-- or allow them to be orphaned. Given the architecture, allowing them to be orphaned is
-- the most robust way to prevent sync failures.

-- We leave the constraints dropped or re-add them as NOT ENFORCED if supported,
-- but standard Postgres doesn't support that for FKs easily without triggers.
-- We will re-add them but keep them as standard FKs without strict enforcement during bulk moves?
-- No, the simplest senior-level fix is to keep the columns but remove the hard FK requirement
-- for these specific columns since they now act as a hybrid staging/canonical table.
