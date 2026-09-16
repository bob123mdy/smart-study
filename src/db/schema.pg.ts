// PostgreSQL 版 schema（pg-core + pgvector）。与 schema.sqlite.ts 字段一一对应。
// 仅方言不同：timestamp_ms(INTEGER) → timestamp；boolean(INTEGER) → boolean；REAL → doublePrecision；
// document_chunks.embedding → vector(1024)（BGE-large-zh-v1.5 维度）。
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";
import type {
  ConversationMode,
  GoalStatus,
  KpStatus,
  MemoryCategory,
  MilestoneStatus,
  ReviewTargetType,
  TaskStatus,
  TeacherType,
  WordStatus,
  WrongErrorType,
  WrongSource,
  WrongStatus,
} from "./schema.sqlite";

const id = () => text("id").primaryKey();
const created = () =>
  timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date());
const updated = () =>
  timestamp("updated_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date());

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email"),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("user"),
  timezone: text("timezone").notNull().default("Asia/Shanghai"),
  settings: text("settings"),
  createdAt: created(),
  updatedAt: updated(),
});

export const sessions = pgTable("sessions", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: created(),
});

export const subjects = pgTable("subjects", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#6366f1"),
  sortOrder: integer("sort_order").notNull().default(0),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
});

export const chapters = pgTable("chapters", {
  id: id(),
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});

export const knowledgePoints = pgTable("knowledge_points", {
  id: id(),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  prerequisites: text("prerequisites"),
  status: text("status").$type<KpStatus>().notNull().default("not_started"),
  mastery: doublePrecision("mastery").notNull().default(0),
  difficulty: integer("difficulty").notNull().default(3),
  lastReviewedAt: timestamp("last_reviewed_at", { mode: "date" }),
  ef: doublePrecision("ef").notNull().default(2.5),
  repetitions: integer("repetitions").notNull().default(0),
  intervalDays: integer("interval_days").notNull().default(0),
  nextReviewAt: timestamp("next_review_at", { mode: "date" }),
  fsrsStability: doublePrecision("fsrs_stability").notNull().default(0),
  fsrsDifficulty: doublePrecision("fsrs_difficulty").notNull().default(0),
  fsrsState: integer("fsrs_state").notNull().default(0),
  fsrsLapses: integer("fsrs_lapses").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});

export const goals = pgTable("goals", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  subjectId: text("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  startDate: text("start_date"),
  targetDate: text("target_date"),
  status: text("status").$type<GoalStatus>().notNull().default("active"),
  progress: doublePrecision("progress").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});

export const milestones = pgTable("milestones", {
  id: id(),
  goalId: text("goal_id")
    .notNull()
    .references(() => goals.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  targetDate: text("target_date"),
  status: text("status").$type<MilestoneStatus>().notNull().default("pending"),
  doneAt: timestamp("done_at", { mode: "date" }),
  createdAt: created(),
  updatedAt: updated(),
});

export const tasks = pgTable("tasks", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
  milestoneId: text("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
  knowledgePointId: text("knowledge_point_id").references(() => knowledgePoints.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  type: text("type").notNull().default("study"),
  scheduledDate: text("scheduled_date"),
  estimatedMinutes: integer("estimated_minutes").notNull().default(30),
  status: text("status").$type<TaskStatus>().notNull().default("todo"),
  doneAt: timestamp("done_at", { mode: "date" }),
  createdAt: created(),
  updatedAt: updated(),
});

export const studySessions = pgTable("study_sessions", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  subjectId: text("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  knowledgePointId: text("knowledge_point_id").references(() => knowledgePoints.id, {
    onDelete: "set null",
  }),
  startedAt: timestamp("started_at", { mode: "date" }).notNull(),
  endedAt: timestamp("ended_at", { mode: "date" }),
  durationMinutes: integer("duration_minutes").notNull().default(0),
  note: text("note"),
  createdAt: created(),
});

export const documents = pgTable("documents", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  fileType: text("file_type").notNull(),
  originalName: text("original_name"),
  filePath: text("file_path"),
  fileSize: integer("file_size").notNull().default(0),
  status: text("status").notNull().default("processing"),
  chunkCount: integer("chunk_count").notNull().default(0),
  errorMsg: text("error_msg"),
  createdAt: created(),
  updatedAt: updated(),
});

export const documentChunks = pgTable("document_chunks", {
  id: id(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count").notNull().default(0),
  embedding: vector("embedding", { dimensions: 1024 }),
  embeddingModel: text("embedding_model"),
  createdAt: created(),
});

export const memories = pgTable("memories", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  category: text("category").$type<MemoryCategory>().notNull().default("preference"),
  content: text("content").notNull(),
  importance: doublePrecision("importance").notNull().default(0.5),
  source: text("source").notNull().default("manual"),
  embedding: text("embedding"),
  meta: text("meta"),
  lastAccessedAt: timestamp("last_accessed_at", { mode: "date" }),
  archived: boolean("archived").notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
});

export const teacherPersonas = pgTable("teacher_personas", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  type: text("type").$type<TeacherType>().notNull(),
  subject: text("subject"),
  subjectId: text("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  avatar: text("avatar"),
  systemPrompt: text("system_prompt"),
  modelTier: text("model_tier").notNull().default("basic"),
  isPreset: boolean("is_preset").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: created(),
  updatedAt: updated(),
});

export const conversations = pgTable("conversations", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  teacherPersonaId: text("teacher_persona_id").references(() => teacherPersonas.id, {
    onDelete: "set null",
  }),
  mode: text("mode").$type<ConversationMode>().notNull().default("explain"),
  title: text("title"),
  knowledgePointId: text("knowledge_point_id").references(() => knowledgePoints.id, {
    onDelete: "set null",
  }),
  createdAt: created(),
  updatedAt: updated(),
});

export const messages = pgTable("messages", {
  id: id(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  model: text("model"),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  meta: text("meta"),
  createdAt: created(),
});

export const llmUsageLogs = pgTable("llm_usage_logs", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  model: text("model").notNull(),
  source: text("source").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCost: doublePrecision("estimated_cost").notNull().default(0),
  latencyMs: integer("latency_ms"),
  createdAt: created(),
});

export const wrongQuestions = pgTable("wrong_questions", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  subjectId: text("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  knowledgePointId: text("knowledge_point_id").references(() => knowledgePoints.id, {
    onDelete: "set null",
  }),
  question: text("question").notNull(),
  answer: text("answer"),
  errorReason: text("error_reason"),
  errorType: text("error_type").$type<WrongErrorType>().notNull().default("concept"),
  source: text("source").$type<WrongSource>().notNull().default("manual"),
  tags: text("tags"),
  status: text("status").$type<WrongStatus>().notNull().default("unreviewed"),
  reviewCount: integer("review_count").notNull().default(0),
  ef: doublePrecision("ef").notNull().default(2.5),
  repetitions: integer("repetitions").notNull().default(0),
  intervalDays: integer("interval_days").notNull().default(0),
  lastReviewedAt: timestamp("last_reviewed_at", { mode: "date" }),
  nextReviewAt: timestamp("next_review_at", { mode: "date" }),
  fsrsStability: doublePrecision("fsrs_stability").notNull().default(0),
  fsrsDifficulty: doublePrecision("fsrs_difficulty").notNull().default(0),
  fsrsState: integer("fsrs_state").notNull().default(0),
  fsrsLapses: integer("fsrs_lapses").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});

export const reviewLogs = pgTable("review_logs", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  targetType: text("target_type").$type<ReviewTargetType>().notNull(),
  targetId: text("target_id").notNull(),
  quality: integer("quality").notNull(),
  efBefore: doublePrecision("ef_before"),
  efAfter: doublePrecision("ef_after"),
  intervalDays: integer("interval_days"),
  reviewedAt: timestamp("reviewed_at", { mode: "date" }).notNull(),
  createdAt: created(),
});

export const wordbooks = pgTable("wordbooks", {
  id: id(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isBuiltin: boolean("is_builtin").notNull().default(false),
  source: text("source").notNull().default("builtin"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});

export const words = pgTable("words", {
  id: id(),
  wordbookId: text("wordbook_id")
    .notNull()
    .references(() => wordbooks.id, { onDelete: "cascade" }),
  word: text("word").notNull(),
  phonetic: text("phonetic"),
  meaning: text("meaning").notNull(),
  example: text("example"),
  exampleMeaning: text("example_meaning"),
  tags: text("tags"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: created(),
});

export const wordProgress = pgTable("word_progress", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  wordId: text("word_id")
    .notNull()
    .references(() => words.id, { onDelete: "cascade" }),
  status: text("status").$type<WordStatus>().notNull().default("new"),
  ef: doublePrecision("ef").notNull().default(2.5),
  repetitions: integer("repetitions").notNull().default(0),
  intervalDays: integer("interval_days").notNull().default(0),
  lastReviewedAt: timestamp("last_reviewed_at", { mode: "date" }),
  nextReviewAt: timestamp("next_review_at", { mode: "date" }),
  wrongCount: integer("wrong_count").notNull().default(0),
  fsrsStability: doublePrecision("fsrs_stability").notNull().default(0),
  fsrsDifficulty: doublePrecision("fsrs_difficulty").notNull().default(0),
  fsrsState: integer("fsrs_state").notNull().default(0),
  fsrsLapses: integer("fsrs_lapses").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});
