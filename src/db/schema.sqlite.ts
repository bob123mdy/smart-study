import { integer, real, text, sqliteTable } from "drizzle-orm/sqlite-core";

// ---- 通用列辅助 ----
const id = () => text("id").primaryKey();
const created = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());
const updated = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

// ---- users 用户 ----
export const users = sqliteTable("users", {
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

// ---- sessions 登录会话（可撤销，token 只存哈希）----
export const sessions = sqliteTable("sessions", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: created(),
});

// ---- subjects 科目 ----
export const subjects = sqliteTable("subjects", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#6366f1"),
  sortOrder: integer("sort_order").notNull().default(0),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
});

// ---- chapters 章节 ----
export const chapters = sqliteTable("chapters", {
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

// ---- knowledgePoints 知识点 ----
export const kpStatus = ["not_started", "learning", "mastered"] as const;
export type KpStatus = (typeof kpStatus)[number];

export const knowledgePoints = sqliteTable("knowledge_points", {
  id: id(),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  prerequisites: text("prerequisites"),
  status: text("status").$type<KpStatus>().notNull().default("not_started"),
  mastery: real("mastery").notNull().default(0),
  difficulty: integer("difficulty").notNull().default(3),
  lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp_ms" }),
  ef: real("ef").notNull().default(2.5),
  repetitions: integer("repetitions").notNull().default(0),
  intervalDays: integer("interval_days").notNull().default(0),
  nextReviewAt: integer("next_review_at", { mode: "timestamp_ms" }),
  fsrsStability: real("fsrs_stability").notNull().default(0),
  fsrsDifficulty: real("fsrs_difficulty").notNull().default(0),
  fsrsState: integer("fsrs_state").notNull().default(0),
  fsrsLapses: integer("fsrs_lapses").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});

// ---- goals 长期目标 ----
export const goalStatus = ["active", "achieved", "abandoned"] as const;
export type GoalStatus = (typeof goalStatus)[number];

export const goals = sqliteTable("goals", {
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
  progress: real("progress").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});

// ---- milestones 里程碑 ----
export const milestoneStatus = ["pending", "in_progress", "done"] as const;
export type MilestoneStatus = (typeof milestoneStatus)[number];

export const milestones = sqliteTable("milestones", {
  id: id(),
  goalId: text("goal_id")
    .notNull()
    .references(() => goals.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  targetDate: text("target_date"),
  status: text("status").$type<MilestoneStatus>().notNull().default("pending"),
  doneAt: integer("done_at", { mode: "timestamp_ms" }),
  createdAt: created(),
  updatedAt: updated(),
});

// ---- tasks 每日任务 ----
export const taskStatus = ["todo", "done", "skipped"] as const;
export type TaskStatus = (typeof taskStatus)[number];

export const tasks = sqliteTable("tasks", {
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
  doneAt: integer("done_at", { mode: "timestamp_ms" }),
  createdAt: created(),
  updatedAt: updated(),
});

// ---- studySessions 学习记录 ----
export const studySessions = sqliteTable("study_sessions", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  subjectId: text("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  knowledgePointId: text("knowledge_point_id").references(() => knowledgePoints.id, {
    onDelete: "set null",
  }),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  durationMinutes: integer("duration_minutes").notNull().default(0),
  note: text("note"),
  createdAt: created(),
});

// ---- documents 资料 / documentChunks 切块（RAG）----
export const documents = sqliteTable("documents", {
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

export const documentChunks = sqliteTable("document_chunks", {
  id: id(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count").notNull().default(0),
  embedding: text("embedding"),
  embeddingModel: text("embedding_model"),
  createdAt: created(),
});

// ---- memories 长期记忆 ----
export const memoryCategory = ["weak_point", "error_pattern", "preference", "habit"] as const;
export type MemoryCategory = (typeof memoryCategory)[number];

export const memories = sqliteTable("memories", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  category: text("category").$type<MemoryCategory>().notNull().default("preference"),
  content: text("content").notNull(),
  importance: real("importance").notNull().default(0.5),
  source: text("source").notNull().default("manual"),
  embedding: text("embedding"),
  meta: text("meta"),
  lastAccessedAt: integer("last_accessed_at", { mode: "timestamp_ms" }),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
});

// ---- teacherPersonas 老师人格 ----
export const teacherType = ["explainer", "quizzer", "grader", "coach", "socratic"] as const;
export type TeacherType = (typeof teacherType)[number];

export const teacherPersonas = sqliteTable("teacher_personas", {
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
  isPreset: integer("is_preset", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: created(),
  updatedAt: updated(),
});

// ---- conversations 会话 / messages 消息 ----
export const conversationMode = ["explain", "quiz", "grader", "coach", "socratic", "course"] as const;
export type ConversationMode = (typeof conversationMode)[number];

export const conversations = sqliteTable("conversations", {
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

export const messages = sqliteTable("messages", {
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

// ---- llmUsageLogs 用量（成本面板原料）----
export const llmUsageLogs = sqliteTable("llm_usage_logs", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  model: text("model").notNull(),
  source: text("source").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCost: real("estimated_cost").notNull().default(0),
  latencyMs: integer("latency_ms"),
  createdAt: created(),
});

// ---- wrongQuestions 错题本 ----
export const wrongErrorType = ["concept", "calculation", "careless", "unknown"] as const;
export type WrongErrorType = (typeof wrongErrorType)[number];

export const wrongSource = ["manual", "exam", "document", "tutoring"] as const;
export type WrongSource = (typeof wrongSource)[number];

export const wrongStatus = ["unreviewed", "reviewing", "mastered"] as const;
export type WrongStatus = (typeof wrongStatus)[number];

export const wrongQuestions = sqliteTable("wrong_questions", {
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
  ef: real("ef").notNull().default(2.5),
  repetitions: integer("repetitions").notNull().default(0),
  intervalDays: integer("interval_days").notNull().default(0),
  lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp_ms" }),
  nextReviewAt: integer("next_review_at", { mode: "timestamp_ms" }),
  fsrsStability: real("fsrs_stability").notNull().default(0),
  fsrsDifficulty: real("fsrs_difficulty").notNull().default(0),
  fsrsState: integer("fsrs_state").notNull().default(0),
  fsrsLapses: integer("fsrs_lapses").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});

// ---- reviewLogs 复习记录（知识点 + 错题通用）----
export const reviewTargetType = ["knowledge_point", "wrong_question", "word"] as const;
export type ReviewTargetType = (typeof reviewTargetType)[number];

export const reviewLogs = sqliteTable("review_logs", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  targetType: text("target_type").$type<ReviewTargetType>().notNull(),
  targetId: text("target_id").notNull(),
  quality: integer("quality").notNull(),
  efBefore: real("ef_before"),
  efAfter: real("ef_after"),
  intervalDays: integer("interval_days"),
  reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: created(),
});

// ---- wordbooks 词库 / words 单词 / wordProgress 学习进度（背单词）----
export const wordStatus = ["new", "learning", "mastered"] as const;
export type WordStatus = (typeof wordStatus)[number];

export const wordbooks = sqliteTable("wordbooks", {
  id: id(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isBuiltin: integer("is_builtin", { mode: "boolean" }).notNull().default(false),
  source: text("source").notNull().default("builtin"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});

export const words = sqliteTable("words", {
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

export const wordProgress = sqliteTable("word_progress", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  wordId: text("word_id")
    .notNull()
    .references(() => words.id, { onDelete: "cascade" }),
  status: text("status").$type<WordStatus>().notNull().default("new"),
  ef: real("ef").notNull().default(2.5),
  repetitions: integer("repetitions").notNull().default(0),
  intervalDays: integer("interval_days").notNull().default(0),
  lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp_ms" }),
  nextReviewAt: integer("next_review_at", { mode: "timestamp_ms" }),
  wrongCount: integer("wrong_count").notNull().default(0),
  fsrsStability: real("fsrs_stability").notNull().default(0),
  fsrsDifficulty: real("fsrs_difficulty").notNull().default(0),
  fsrsState: integer("fsrs_state").notNull().default(0),
  fsrsLapses: integer("fsrs_lapses").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});

// ---- 常用类型导出 ----
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type KnowledgePoint = typeof knowledgePoints.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
export type TeacherPersona = typeof teacherPersonas.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type WrongQuestion = typeof wrongQuestions.$inferSelect;
export type ReviewLog = typeof reviewLogs.$inferSelect;
export type Wordbook = typeof wordbooks.$inferSelect;
export type Word = typeof words.$inferSelect;
export type WordProgress = typeof wordProgress.$inferSelect;
