INSERT INTO "practice_history" (
  "task_id",
  "lexeme_id",
  "pos",
  "task_type",
  "renderer",
  "device_id",
  "user_id",
  "result",
  "response_ms",
  "submitted_at",
  "answered_at",
  "queued_at",
  "cefr_level",
  "hints_used",
  "metadata"
)
SELECT
  mobile."task_id",
  mobile."lexeme_id",
  COALESCE(mobile."pos", tasks."pos"),
  COALESCE(mobile."task_type", tasks."task_type"),
  COALESCE(mobile."renderer", tasks."renderer"),
  mobile."device_id",
  mobile."user_id"::text,
  mobile."result"::practice_result,
  COALESCE(mobile."response_ms", 0),
  COALESCE(mobile."submitted_at", '1970-01-01T00:00:00Z'::timestamptz),
  COALESCE(mobile."submitted_at", '1970-01-01T00:00:00Z'::timestamptz),
  NULL,
  mobile."cefr_level",
  COALESCE(mobile."hints_used", false),
  jsonb_build_object(
    'submittedResponse', mobile."submitted_answer",
    'expectedResponse', mobile."correct_answer",
    'promptSummary', COALESCE(mobile."lemma", lexemes."lemma") || ' - ' || COALESCE(mobile."task_type", tasks."task_type"),
    'queueCap', NULL::text,
    'frequencyRank', lexemes."frequency_rank"::text,
    'legacyVerb', NULL::text,
    'backfilledFrom', 'user_practice_history'
  )
FROM "user_practice_history" mobile
INNER JOIN "task_specs" tasks ON tasks."id" = mobile."task_id"
INNER JOIN "lexemes" lexemes ON lexemes."id" = mobile."lexeme_id"
LEFT JOIN "practice_history" existing
  ON existing."user_id" = mobile."user_id"::text
  AND existing."task_id" = mobile."task_id"
  AND existing."device_id" = mobile."device_id"
  AND existing."submitted_at" = COALESCE(mobile."submitted_at", '1970-01-01T00:00:00Z'::timestamptz)
WHERE existing."id" IS NULL
  AND mobile."result" IN ('correct', 'incorrect')
  AND mobile."device_id" IS NOT NULL;
