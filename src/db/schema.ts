// 方言门面：默认 SQLite（零配置）；设置 DATABASE_URL 后运行时切换到 PostgreSQL/pgvector。
// 表对象的「静态类型」固定为 SQLite 版（两版字段名一致、结构相同），运行时按需选方言实例。
import * as sqlite from "./schema.sqlite";
import * as pg from "./schema.pg";

const USE_PG = !!process.env.DATABASE_URL;
function pick<S, P>(s: S, p: P): S {
  return (USE_PG ? (p as unknown as S) : s);
}

export const users = pick(sqlite.users, pg.users);
export const sessions = pick(sqlite.sessions, pg.sessions);
export const subjects = pick(sqlite.subjects, pg.subjects);
export const chapters = pick(sqlite.chapters, pg.chapters);
export const knowledgePoints = pick(sqlite.knowledgePoints, pg.knowledgePoints);
export const goals = pick(sqlite.goals, pg.goals);
export const milestones = pick(sqlite.milestones, pg.milestones);
export const tasks = pick(sqlite.tasks, pg.tasks);
export const studySessions = pick(sqlite.studySessions, pg.studySessions);
export const documents = pick(sqlite.documents, pg.documents);
export const documentChunks = pick(sqlite.documentChunks, pg.documentChunks);
export const memories = pick(sqlite.memories, pg.memories);
export const teacherPersonas = pick(sqlite.teacherPersonas, pg.teacherPersonas);
export const conversations = pick(sqlite.conversations, pg.conversations);
export const messages = pick(sqlite.messages, pg.messages);
export const llmUsageLogs = pick(sqlite.llmUsageLogs, pg.llmUsageLogs);
export const wrongQuestions = pick(sqlite.wrongQuestions, pg.wrongQuestions);
export const reviewLogs = pick(sqlite.reviewLogs, pg.reviewLogs);
export const wordbooks = pick(sqlite.wordbooks, pg.wordbooks);
export const words = pick(sqlite.words, pg.words);
export const wordProgress = pick(sqlite.wordProgress, pg.wordProgress);

export {
  kpStatus,
  goalStatus,
  milestoneStatus,
  taskStatus,
  memoryCategory,
  teacherType,
  conversationMode,
  wrongErrorType,
  wrongSource,
  wrongStatus,
  reviewTargetType,
  wordStatus,
} from "./schema.sqlite";

export type {
  KpStatus,
  GoalStatus,
  MilestoneStatus,
  TaskStatus,
  MemoryCategory,
  TeacherType,
  ConversationMode,
  WrongErrorType,
  WrongSource,
  WrongStatus,
  ReviewTargetType,
  User,
  Session,
  Subject,
  Chapter,
  KnowledgePoint,
  Goal,
  Milestone,
  Task,
  StudySession,
  TeacherPersona,
  Conversation,
  Message,
  Memory,
  Document,
  DocumentChunk,
  WrongQuestion,
  ReviewLog,
  WordStatus,
  Wordbook,
  Word,
  WordProgress,
} from "./schema.sqlite";
