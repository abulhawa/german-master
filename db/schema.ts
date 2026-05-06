import type { PracticeResult, WordExample, WordPosAttributes, WordTranslation } from "@shared";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const practiceResult = ["correct", "incorrect"] as const satisfies ReadonlyArray<PracticeResult>;
const practiceResultEnum = pgEnum("practice_result", practiceResult);
export const enrichmentMethodEnum = pgEnum("enrichment_method", [
  "bulk",
  "manual_api",
  "manual_entry",
  "preexisting",
]);

export const words = pgTable(
  "words",
  {
    id: serial("id").primaryKey(),
    lemma: text("lemma").notNull(),
    pos: text("pos").notNull(),
    level: text("level"),
    english: text("english"),
    exampleDe: text("example_de"),
    exampleEn: text("example_en"),
    gender: text("gender"),
    plural: text("plural"),
    separable: boolean("separable"),
    aux: text("aux"),
    praesensIch: text("praesens_ich"),
    praesensEr: text("praesens_er"),
    praeteritum: text("praeteritum"),
    partizipIi: text("partizip_ii"),
    perfekt: text("perfekt"),
    comparative: text("comparative"),
    superlative: text("superlative"),
    approved: boolean("approved").default(false).notNull(),
    complete: boolean("complete").default(false).notNull(),
    sourcesCsv: text("sources_csv"),
    sourceNotes: text("source_notes"),
    collections: jsonb("collections").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    exportUid: uuid("export_uid").default(sql`gen_random_uuid()`).notNull(),
    exportedAt: timestamp("exported_at", { withTimezone: true }),
    translations: jsonb("translations").$type<
      | Array<{
          value: string;
          source?: string | null;
          language?: string | null;
          confidence?: number | null;
        }>
      | null
    >(),
    examples: jsonb("examples").$type<
      | Array<{
          sentence?: string | null;
          translations?: Record<string, string | null | undefined> | null;
          exampleDe?: string | null;
          exampleEn?: string | null;
        }>
      | null
    >(),
    posAttributes: jsonb("pos_attributes").$type<WordPosAttributes | null>(),
    enrichmentAppliedAt: timestamp("enrichment_applied_at", { withTimezone: true }),
    enrichmentMethod: enrichmentMethodEnum("enrichment_method"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("words_lemma_pos_idx").on(table.lemma, table.pos),
    check(
      "words_pos_normalized_chk",
      sql`${table.pos} IN ('Pr\u00e4p', 'Pron', 'V', 'Adv', 'N', 'Konj', 'Adj', 'Part')`,
    ),
  ],
);


export const lexemes = pgTable(
  "lexemes",
  {
    id: text("id").primaryKey(),
    lemma: text("lemma").notNull(),
    language: text("language").notNull().default("de"),
    pos: text("pos").notNull(),
    gender: text("gender"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    frequencyRank: integer("frequency_rank"),
    sourceIds: jsonb("source_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    revision: integer("revision").notNull().default(1),
  },
  (table) => [
    uniqueIndex("lexemes_lemma_pos_idx").on(table.lemma, table.pos),
    check(
      "lexemes_pos_normalized_chk",
      sql`${table.pos} IN ('Pr\u00e4p', 'Pron', 'V', 'Adv', 'N', 'Konj', 'Adj', 'Part')`,
    ),
  ],
);

export const inflections = pgTable(
  "inflections",
  {
    id: text("id").primaryKey(),
    lexemeId: text("lexeme_id")
      .notNull()
      .references(() => lexemes.id, { onDelete: "cascade" }),
    form: text("form").notNull(),
    features: jsonb("features")
      .$type<Record<string, unknown>>()
      .notNull(),
    audioAsset: text("audio_asset"),
    sourceRevision: text("source_revision"),
    checksum: text("checksum"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    revision: integer("revision").notNull().default(1),
  },
  (table) => [
    uniqueIndex("inflections_lexeme_form_features_idx").on(
      table.lexemeId,
      table.form,
      table.features,
    ),
  ],
);

export const taskSpecs = pgTable(
  "task_specs",
  {
    id: text("id").primaryKey(),
    lexemeId: text("lexeme_id")
      .notNull()
      .references(() => lexemes.id, { onDelete: "cascade" }),
    pos: text("pos").notNull(),
    taskType: text("task_type").notNull(),
    renderer: text("renderer").notNull(),
    prompt: jsonb("prompt").$type<Record<string, unknown>>().notNull(),
    solution: jsonb("solution").$type<Record<string, unknown>>().notNull(),
    hints: jsonb("hints").$type<unknown[]>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("task_specs_lexeme_type_revision_idx").on(
      table.lexemeId,
      table.taskType,
      table.revision,
    ),
    index("task_specs_pos_idx").on(table.pos),
    check(
      "task_specs_pos_normalized_chk",
      sql`${table.pos} IN ('Pr\u00e4p', 'Pron', 'V', 'Adv', 'N', 'Konj', 'Adj', 'Part')`,
    ),
  ],
);

export const taskSyncState = pgTable("task_sync_state", {
  id: text("id").primaryKey(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  versionHash: text("version_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const practiceHistory = pgTable(
  "practice_history",
  {
    id: serial("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskSpecs.id, { onDelete: "cascade" }),
    lexemeId: text("lexeme_id")
      .notNull()
      .references(() => lexemes.id, { onDelete: "cascade" }),
    pos: text("pos").notNull(),
    taskType: text("task_type").notNull(),
    renderer: text("renderer").notNull(),
    deviceId: text("device_id").notNull(),
    userId: text("user_id"),
    result: practiceResultEnum("result").notNull(),
    responseMs: integer("response_ms").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    queuedAt: timestamp("queued_at", { withTimezone: true }),
    lemma: text("lemma"),
    submittedAnswer: text("submitted_answer"),
    correctAnswer: text("correct_answer"),
    cefrLevel: text("cefr_level"),
    collections: jsonb("collections").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    hintsUsed: boolean("hints_used").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("practice_history_task_idx").on(table.taskId),
    index("practice_history_pos_idx").on(table.pos),
    index("practice_history_submitted_idx").on(table.submittedAt),
    index("practice_history_device_idx").on(table.deviceId),
    index("practice_history_user_idx").on(table.userId),
    check(
      "practice_history_pos_normalized_chk",
      sql`${table.pos} IN ('Pr\u00e4p', 'Pron', 'V', 'Adv', 'N', 'Konj', 'Adj', 'Part')`,
    ),
  ],
);

export const practiceLog = pgTable(
  "practice_log",
  {
    id: serial("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => taskSpecs.id, { onDelete: "cascade" }),
    lexemeId: text("lexeme_id")
      .notNull()
      .references(() => lexemes.id, { onDelete: "cascade" }),
    pos: text("pos").notNull(),
    taskType: text("task_type").notNull(),
    deviceId: text("device_id"),
    userId: text("user_id"),
    cefrLevel: text("cefr_level").notNull().default("__"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("practice_log_task_idx").on(table.taskId),
    index("practice_log_pos_idx").on(table.pos),
    index("practice_log_attempted_idx").on(table.attemptedAt),
    index("practice_log_device_idx").on(table.deviceId),
    index("practice_log_user_idx").on(table.userId),
    uniqueIndex("practice_log_user_task_idx").on(table.taskId, table.userId, table.cefrLevel),
    uniqueIndex("practice_log_device_task_idx").on(table.taskId, table.deviceId, table.cefrLevel),
    check(
      "practice_log_pos_normalized_chk",
      sql`${table.pos} IN ('Pr\u00e4p', 'Pron', 'V', 'Adv', 'N', 'Konj', 'Adj', 'Part')`,
    ),
  ],
);

export const insertWordSchema = createInsertSchema(words);
export const selectWordSchema = createSelectSchema(words);
export type InsertWord = typeof words.$inferInsert;
export type Word = typeof words.$inferSelect;

export type PracticeHistory = typeof practiceHistory.$inferSelect;
export type InsertPracticeHistory = typeof practiceHistory.$inferInsert;

export type PracticeLog = typeof practiceLog.$inferSelect;
export type InsertPracticeLog = typeof practiceLog.$inferInsert;

