ALTER TABLE "words" DROP CONSTRAINT IF EXISTS "words_pos_normalized_chk";
ALTER TABLE "lexemes" DROP CONSTRAINT IF EXISTS "lexemes_pos_normalized_chk";
ALTER TABLE "task_specs" DROP CONSTRAINT IF EXISTS "task_specs_pos_normalized_chk";
ALTER TABLE "practice_history" DROP CONSTRAINT IF EXISTS "practice_history_pos_normalized_chk";
ALTER TABLE "practice_log" DROP CONSTRAINT IF EXISTS "practice_log_pos_normalized_chk";

DROP TABLE IF EXISTS "_compact_pos_normalization";
CREATE TABLE "_compact_pos_normalization" (
  "value" text PRIMARY KEY,
  "normalized" text NOT NULL
);

INSERT INTO "_compact_pos_normalization" ("value", "normalized") VALUES
  ('v', 'V'),
  ('verb', 'V'),
  ('verbs', 'V'),
  ('verben', 'V'),
  ('n', 'N'),
  ('noun', 'N'),
  ('nouns', 'N'),
  ('nomen', 'N'),
  ('substantiv', 'N'),
  ('subst', 'N'),
  ('propn', 'N'),
  ('propernoun', 'N'),
  ('adj', 'Adj'),
  ('adjective', 'Adj'),
  ('adjectives', 'Adj'),
  ('adjektiv', 'Adj'),
  ('num', 'Adj'),
  ('numeral', 'Adj'),
  ('numerale', 'Adj'),
  ('zahlwort', 'Adj'),
  ('adv', 'Adv'),
  ('adverb', 'Adv'),
  ('pron', 'Pron'),
  ('pronoun', 'Pron'),
  ('pronomen', 'Pron'),
  ('det', 'Pron'),
  ('determiner', 'Pron'),
  ('art', 'Pron'),
  ('article', 'Pron'),
  ('artikel', 'Pron'),
  ('prep', 'Präp'),
  ('adp', 'Präp'),
  ('praep', 'Präp'),
  ('praeposition', 'Präp'),
  ('preposition', 'Präp'),
  ('präp', 'Präp'),
  ('präposition', 'Präp'),
  ('prã¤p', 'Präp'),
  ('prã¤position', 'Präp'),
  ('prãƒâ¤p', 'Präp'),
  ('konj', 'Konj'),
  ('conj', 'Konj'),
  ('conjunction', 'Konj'),
  ('konjunktion', 'Konj'),
  ('cconj', 'Konj'),
  ('sconj', 'Konj'),
  ('part', 'Part'),
  ('particle', 'Part'),
  ('partikel', 'Part'),
  ('int', 'Part'),
  ('intj', 'Part'),
  ('interj', 'Part'),
  ('interjection', 'Part'),
  ('interjektion', 'Part');

UPDATE "words"
SET "pos" = normalized."normalized"
FROM "_compact_pos_normalization" normalized
WHERE lower("words"."pos") = normalized."value"
  AND "words"."pos" <> normalized."normalized";

UPDATE "lexemes"
SET "pos" = normalized."normalized"
FROM "_compact_pos_normalization" normalized
WHERE lower("lexemes"."pos") = normalized."value"
  AND "lexemes"."pos" <> normalized."normalized";

UPDATE "task_specs"
SET "pos" = normalized."normalized"
FROM "_compact_pos_normalization" normalized
WHERE lower("task_specs"."pos") = normalized."value"
  AND "task_specs"."pos" <> normalized."normalized";

UPDATE "practice_history"
SET "pos" = normalized."normalized"
FROM "_compact_pos_normalization" normalized
WHERE lower("practice_history"."pos") = normalized."value"
  AND "practice_history"."pos" <> normalized."normalized";

UPDATE "practice_log"
SET "pos" = normalized."normalized"
FROM "_compact_pos_normalization" normalized
WHERE lower("practice_log"."pos") = normalized."value"
  AND "practice_log"."pos" <> normalized."normalized";

UPDATE "task_specs"
SET "prompt" = jsonb_set(
  "task_specs"."prompt",
  '{pos}',
  CASE normalized."normalized"
    WHEN 'V' THEN '"V"'::jsonb
    WHEN 'N' THEN '"N"'::jsonb
    WHEN 'Adj' THEN '"Adj"'::jsonb
    WHEN 'Adv' THEN '"Adv"'::jsonb
    WHEN 'Pron' THEN '"Pron"'::jsonb
    WHEN 'Präp' THEN '"Präp"'::jsonb
    WHEN 'Konj' THEN '"Konj"'::jsonb
    ELSE '"Part"'::jsonb
  END,
  false
)
FROM "_compact_pos_normalization" normalized
WHERE "task_specs"."prompt" ->> 'pos' IS NOT NULL
  AND lower("task_specs"."prompt" ->> 'pos') = normalized."value"
  AND "task_specs"."prompt" ->> 'pos' <> normalized."normalized";

DO $$
BEGIN
  IF to_regclass('public.user_practice_history') IS NOT NULL THEN
    ALTER TABLE "user_practice_history" DROP CONSTRAINT IF EXISTS "user_practice_history_pos_normalized_chk";

    UPDATE "user_practice_history"
    SET "pos" = normalized."normalized"
    FROM "_compact_pos_normalization" normalized
    WHERE lower("user_practice_history"."pos") = normalized."value"
      AND "user_practice_history"."pos" <> normalized."normalized";

    ALTER TABLE "user_practice_history"
      ADD CONSTRAINT "user_practice_history_pos_normalized_chk"
      CHECK ("pos" IN ('Präp', 'Pron', 'V', 'Adv', 'N', 'Konj', 'Adj', 'Part'));
  END IF;
END $$;

ALTER TABLE "words"
  ADD CONSTRAINT "words_pos_normalized_chk"
  CHECK ("pos" IN ('Präp', 'Pron', 'V', 'Adv', 'N', 'Konj', 'Adj', 'Part'));

ALTER TABLE "lexemes"
  ADD CONSTRAINT "lexemes_pos_normalized_chk"
  CHECK ("pos" IN ('Präp', 'Pron', 'V', 'Adv', 'N', 'Konj', 'Adj', 'Part'));

ALTER TABLE "task_specs"
  ADD CONSTRAINT "task_specs_pos_normalized_chk"
  CHECK ("pos" IN ('Präp', 'Pron', 'V', 'Adv', 'N', 'Konj', 'Adj', 'Part'));

ALTER TABLE "practice_history"
  ADD CONSTRAINT "practice_history_pos_normalized_chk"
  CHECK ("pos" IN ('Präp', 'Pron', 'V', 'Adv', 'N', 'Konj', 'Adj', 'Part'));

ALTER TABLE "practice_log"
  ADD CONSTRAINT "practice_log_pos_normalized_chk"
  CHECK ("pos" IN ('Präp', 'Pron', 'V', 'Adv', 'N', 'Konj', 'Adj', 'Part'));

DROP TABLE "_compact_pos_normalization";
