DROP TABLE IF EXISTS "_legacy_pos_normalization";
CREATE TABLE "_legacy_pos_normalization" (
  "value" text PRIMARY KEY,
  "normalized" text NOT NULL
);

INSERT INTO "_legacy_pos_normalization" ("value", "normalized") VALUES
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
  ('adv', 'Adv'),
  ('adverb', 'Adv'),
  ('pron', 'Pron'),
  ('pronoun', 'Pron'),
  ('pronomen', 'Pron'),
  ('det', 'Det'),
  ('determiner', 'Det'),
  ('art', 'Det'),
  ('artikel', 'Det'),
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
  ('num', 'Num'),
  ('numeral', 'Num'),
  ('numerale', 'Num'),
  ('zahlwort', 'Num'),
  ('part', 'Part'),
  ('particle', 'Part'),
  ('partikel', 'Part'),
  ('int', 'Interj'),
  ('intj', 'Interj'),
  ('interj', 'Interj'),
  ('interjection', 'Interj'),
  ('interjektion', 'Interj');

UPDATE "words"
SET "pos" = normalized."normalized"
FROM "_legacy_pos_normalization" normalized
WHERE lower("words"."pos") = normalized."value"
  AND "words"."pos" <> normalized."normalized";

DROP TABLE IF EXISTS "_lexeme_pos_normalization";
CREATE TABLE "_lexeme_pos_normalization" (
  "value" text PRIMARY KEY,
  "normalized" text NOT NULL
);

INSERT INTO "_lexeme_pos_normalization" ("value", "normalized")
SELECT "value",
  CASE "normalized"
    WHEN 'V' THEN 'verb'
    WHEN 'N' THEN 'noun'
    WHEN 'Adj' THEN 'adjective'
    WHEN 'Adv' THEN 'adverb'
    WHEN 'Pron' THEN 'pronoun'
    WHEN 'Det' THEN 'determiner'
    WHEN 'Präp' THEN 'preposition'
    WHEN 'Konj' THEN 'conjunction'
    WHEN 'Num' THEN 'numeral'
    WHEN 'Part' THEN 'particle'
    WHEN 'Interj' THEN 'interjection'
  END
FROM "_legacy_pos_normalization";

INSERT INTO "_lexeme_pos_normalization" ("value", "normalized") VALUES
  ('verb', 'verb'),
  ('noun', 'noun'),
  ('adjective', 'adjective'),
  ('adverb', 'adverb'),
  ('pronoun', 'pronoun'),
  ('determiner', 'determiner'),
  ('preposition', 'preposition'),
  ('conjunction', 'conjunction'),
  ('numeral', 'numeral'),
  ('particle', 'particle'),
  ('interjection', 'interjection')
ON CONFLICT ("value") DO UPDATE SET "normalized" = EXCLUDED."normalized";

UPDATE "lexemes"
SET "pos" = normalized."normalized"
FROM "_lexeme_pos_normalization" normalized
WHERE lower("lexemes"."pos") = normalized."value"
  AND "lexemes"."pos" <> normalized."normalized";

UPDATE "task_specs"
SET "pos" = normalized."normalized"
FROM "_lexeme_pos_normalization" normalized
WHERE lower("task_specs"."pos") = normalized."value"
  AND "task_specs"."pos" <> normalized."normalized";

UPDATE "practice_history"
SET "pos" = normalized."normalized"
FROM "_lexeme_pos_normalization" normalized
WHERE lower("practice_history"."pos") = normalized."value"
  AND "practice_history"."pos" <> normalized."normalized";

UPDATE "practice_log"
SET "pos" = normalized."normalized"
FROM "_lexeme_pos_normalization" normalized
WHERE lower("practice_log"."pos") = normalized."value"
  AND "practice_log"."pos" <> normalized."normalized";

UPDATE "user_practice_history"
SET "pos" = normalized."normalized"
FROM "_lexeme_pos_normalization" normalized
WHERE lower("user_practice_history"."pos") = normalized."value"
  AND "user_practice_history"."pos" <> normalized."normalized";

ALTER TABLE "words" DROP CONSTRAINT IF EXISTS "words_pos_normalized_chk";
ALTER TABLE "words"
  ADD CONSTRAINT "words_pos_normalized_chk"
  CHECK ("pos" IN ('V', 'N', 'Adj', 'Adv', 'Pron', 'Det', 'Präp', 'Konj', 'Num', 'Part', 'Interj'));

ALTER TABLE "lexemes" DROP CONSTRAINT IF EXISTS "lexemes_pos_normalized_chk";
ALTER TABLE "lexemes"
  ADD CONSTRAINT "lexemes_pos_normalized_chk"
  CHECK ("pos" IN ('verb', 'noun', 'adjective', 'adverb', 'pronoun', 'determiner', 'preposition', 'conjunction', 'numeral', 'particle', 'interjection'));

ALTER TABLE "task_specs" DROP CONSTRAINT IF EXISTS "task_specs_pos_normalized_chk";
ALTER TABLE "task_specs"
  ADD CONSTRAINT "task_specs_pos_normalized_chk"
  CHECK ("pos" IN ('verb', 'noun', 'adjective', 'adverb', 'pronoun', 'determiner', 'preposition', 'conjunction', 'numeral', 'particle', 'interjection'));

ALTER TABLE "practice_history" DROP CONSTRAINT IF EXISTS "practice_history_pos_normalized_chk";
ALTER TABLE "practice_history"
  ADD CONSTRAINT "practice_history_pos_normalized_chk"
  CHECK ("pos" IN ('verb', 'noun', 'adjective', 'adverb', 'pronoun', 'determiner', 'preposition', 'conjunction', 'numeral', 'particle', 'interjection'));

ALTER TABLE "practice_log" DROP CONSTRAINT IF EXISTS "practice_log_pos_normalized_chk";
ALTER TABLE "practice_log"
  ADD CONSTRAINT "practice_log_pos_normalized_chk"
  CHECK ("pos" IN ('verb', 'noun', 'adjective', 'adverb', 'pronoun', 'determiner', 'preposition', 'conjunction', 'numeral', 'particle', 'interjection'));

ALTER TABLE "user_practice_history" DROP CONSTRAINT IF EXISTS "user_practice_history_pos_normalized_chk";
ALTER TABLE "user_practice_history"
  ADD CONSTRAINT "user_practice_history_pos_normalized_chk"
  CHECK ("pos" IN ('verb', 'noun', 'adjective', 'adverb', 'pronoun', 'determiner', 'preposition', 'conjunction', 'numeral', 'particle', 'interjection'));

DROP TABLE "_lexeme_pos_normalization";
DROP TABLE "_legacy_pos_normalization";
