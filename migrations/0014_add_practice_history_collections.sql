ALTER TABLE "practice_history"
ADD COLUMN IF NOT EXISTS "collections" jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE "practice_history"
SET "collections" = "metadata"->'collections'
WHERE "metadata" IS NOT NULL
  AND ("metadata"->'collections') IS NOT NULL;

UPDATE "practice_history"
SET "collections" = '["b2_beruf"]'::jsonb
WHERE "cefr_level" = 'B2 Beruf';

UPDATE "practice_history"
SET "cefr_level" = 'B2'
WHERE "cefr_level" = 'B2 Beruf';
