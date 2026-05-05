ALTER TABLE "words"
ADD COLUMN IF NOT EXISTS "collections" jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE "words"
SET "collections" = '[]'::jsonb
WHERE "collections" IS NULL;
