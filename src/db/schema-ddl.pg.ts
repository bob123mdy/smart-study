// PostgreSQL 建表 DDL（幂等）+ pgvector 扩展。与 schema.pg.ts 对应。
// 注意：索引名全局唯一，故 study_sessions 的 user_id 索引改名（避免与 sessions 的 idx_sessions_user 冲突）。
export const PG_SCHEMA_DDL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  timezone      TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  settings      TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

CREATE TABLE IF NOT EXISTS subjects (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  name         TEXT NOT NULL,
  description  TEXT,
  color        TEXT NOT NULL DEFAULT '#6366f1',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_archived  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);

CREATE TABLE IF NOT EXISTS chapters (
  id           TEXT PRIMARY KEY,
  subject_id   TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chapters_subject ON chapters(subject_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chapters_subject_name ON chapters(subject_id, name);

CREATE TABLE IF NOT EXISTS knowledge_points (
  id               TEXT PRIMARY KEY,
  chapter_id       TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  prerequisites    TEXT,
  status           TEXT NOT NULL DEFAULT 'not_started',
  mastery          DOUBLE PRECISION NOT NULL DEFAULT 0,
  difficulty       INTEGER NOT NULL DEFAULT 3,
  last_reviewed_at TIMESTAMP,
  ef               DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  repetitions      INTEGER NOT NULL DEFAULT 0,
  interval_days    INTEGER NOT NULL DEFAULT 0,
  next_review_at   TIMESTAMP,
  fsrs_stability   DOUBLE PRECISION NOT NULL DEFAULT 0,
  fsrs_difficulty  DOUBLE PRECISION NOT NULL DEFAULT 0,
  fsrs_state       INTEGER NOT NULL DEFAULT 0,
  fsrs_lapses      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kp_chapter ON knowledge_points(chapter_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kp_chapter_name ON knowledge_points(chapter_id, name);
CREATE INDEX IF NOT EXISTS idx_kp_next ON knowledge_points(next_review_at);

CREATE TABLE IF NOT EXISTS goals (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  title        TEXT NOT NULL,
  description  TEXT,
  subject_id   TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  start_date   TEXT,
  target_date  TEXT,
  status       TEXT NOT NULL DEFAULT 'active',
  progress     DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);

CREATE TABLE IF NOT EXISTS milestones (
  id           TEXT PRIMARY KEY,
  goal_id      TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  target_date  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  done_at      TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_milestones_goal ON milestones(goal_id);

CREATE TABLE IF NOT EXISTS tasks (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id),
  goal_id            TEXT REFERENCES goals(id) ON DELETE SET NULL,
  milestone_id       TEXT REFERENCES milestones(id) ON DELETE SET NULL,
  knowledge_point_id TEXT REFERENCES knowledge_points(id) ON DELETE SET NULL,
  title              TEXT NOT NULL,
  type               TEXT NOT NULL DEFAULT 'study',
  scheduled_date     TEXT,
  estimated_minutes  INTEGER NOT NULL DEFAULT 30,
  status             TEXT NOT NULL DEFAULT 'todo',
  done_at            TIMESTAMP,
  created_at         TIMESTAMP NOT NULL DEFAULT now(),
  updated_at         TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(scheduled_date);

CREATE TABLE IF NOT EXISTS study_sessions (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id),
  subject_id         TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  knowledge_point_id TEXT REFERENCES knowledge_points(id) ON DELETE SET NULL,
  started_at         TIMESTAMP NOT NULL,
  ended_at           TIMESTAMP,
  duration_minutes   INTEGER NOT NULL DEFAULT 0,
  note               TEXT,
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_started ON study_sessions(started_at);

CREATE TABLE IF NOT EXISTS documents (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  title         TEXT NOT NULL,
  file_type     TEXT NOT NULL,
  original_name TEXT,
  file_path     TEXT,
  file_size     INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'processing',
  chunk_count   INTEGER NOT NULL DEFAULT 0,
  error_msg     TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);

CREATE TABLE IF NOT EXISTS document_chunks (
  id              TEXT PRIMARY KEY,
  document_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index     INTEGER NOT NULL,
  content         TEXT NOT NULL,
  token_count     INTEGER NOT NULL DEFAULT 0,
  embedding       vector(1024),
  embedding_model TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);

CREATE TABLE IF NOT EXISTS memories (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  category         TEXT NOT NULL DEFAULT 'preference',
  content          TEXT NOT NULL,
  importance       DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  source           TEXT NOT NULL DEFAULT 'manual',
  embedding        TEXT,
  meta             TEXT,
  last_accessed_at TIMESTAMP,
  archived         BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMP NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);

CREATE TABLE IF NOT EXISTS teacher_personas (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id),
  name           TEXT NOT NULL,
  type           TEXT NOT NULL,
  subject        TEXT,
  subject_id     TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  avatar         TEXT,
  system_prompt  TEXT,
  model_tier     TEXT NOT NULL DEFAULT 'basic',
  is_preset      BOOLEAN NOT NULL DEFAULT false,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teachers_user ON teacher_personas(user_id);

CREATE TABLE IF NOT EXISTS conversations (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id),
  teacher_persona_id TEXT REFERENCES teacher_personas(id) ON DELETE SET NULL,
  mode               TEXT NOT NULL DEFAULT 'explain',
  title              TEXT,
  knowledge_point_id TEXT REFERENCES knowledge_points(id) ON DELETE SET NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT now(),
  updated_at         TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);

CREATE TABLE IF NOT EXISTS messages (
  id                 TEXT PRIMARY KEY,
  conversation_id    TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role               TEXT NOT NULL,
  content            TEXT NOT NULL,
  model              TEXT,
  prompt_tokens      INTEGER NOT NULL DEFAULT 0,
  completion_tokens  INTEGER NOT NULL DEFAULT 0,
  meta               TEXT,
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

CREATE TABLE IF NOT EXISTS llm_usage_logs (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id),
  model              TEXT NOT NULL,
  source             TEXT NOT NULL,
  prompt_tokens      INTEGER NOT NULL DEFAULT 0,
  completion_tokens  INTEGER NOT NULL DEFAULT 0,
  total_tokens       INTEGER NOT NULL DEFAULT 0,
  estimated_cost     DOUBLE PRECISION NOT NULL DEFAULT 0,
  latency_ms         INTEGER,
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_user ON llm_usage_logs(user_id);

CREATE TABLE IF NOT EXISTS wrong_questions (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id),
  subject_id         TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  knowledge_point_id TEXT REFERENCES knowledge_points(id) ON DELETE SET NULL,
  question           TEXT NOT NULL,
  answer             TEXT,
  error_reason       TEXT,
  error_type         TEXT NOT NULL DEFAULT 'concept',
  source             TEXT NOT NULL DEFAULT 'manual',
  tags               TEXT,
  status             TEXT NOT NULL DEFAULT 'unreviewed',
  review_count       INTEGER NOT NULL DEFAULT 0,
  ef                 DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  repetitions        INTEGER NOT NULL DEFAULT 0,
  interval_days      INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at   TIMESTAMP,
  next_review_at     TIMESTAMP,
  fsrs_stability     DOUBLE PRECISION NOT NULL DEFAULT 0,
  fsrs_difficulty    DOUBLE PRECISION NOT NULL DEFAULT 0,
  fsrs_state         INTEGER NOT NULL DEFAULT 0,
  fsrs_lapses        INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMP NOT NULL DEFAULT now(),
  updated_at         TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wq_user ON wrong_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_wq_kp ON wrong_questions(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_wq_next ON wrong_questions(next_review_at);

CREATE TABLE IF NOT EXISTS review_logs (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  target_type   TEXT NOT NULL,
  target_id     TEXT NOT NULL,
  quality       INTEGER NOT NULL,
  ef_before     DOUBLE PRECISION,
  ef_after      DOUBLE PRECISION,
  interval_days INTEGER,
  reviewed_at   TIMESTAMP NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_logs_target ON review_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_review_logs_user ON review_logs(user_id);

CREATE TABLE IF NOT EXISTS wordbooks (
  id           TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  is_builtin   BOOLEAN NOT NULL DEFAULT false,
  source       TEXT NOT NULL DEFAULT 'builtin',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wordbooks_user ON wordbooks(user_id);

CREATE TABLE IF NOT EXISTS words (
  id              TEXT PRIMARY KEY,
  wordbook_id     TEXT NOT NULL REFERENCES wordbooks(id) ON DELETE CASCADE,
  word            TEXT NOT NULL,
  phonetic        TEXT,
  meaning         TEXT NOT NULL,
  example         TEXT,
  example_meaning TEXT,
  tags            TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_words_book ON words(wordbook_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_words_book_word ON words(wordbook_id, word);

CREATE TABLE IF NOT EXISTS word_progress (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id          TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'new',
  ef               DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  repetitions      INTEGER NOT NULL DEFAULT 0,
  interval_days    INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMP,
  next_review_at   TIMESTAMP,
  wrong_count      INTEGER NOT NULL DEFAULT 0,
  fsrs_stability   DOUBLE PRECISION NOT NULL DEFAULT 0,
  fsrs_difficulty  DOUBLE PRECISION NOT NULL DEFAULT 0,
  fsrs_state       INTEGER NOT NULL DEFAULT 0,
  fsrs_lapses      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_word_progress_user ON word_progress(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_word_progress_user_word ON word_progress(user_id, word_id);
CREATE INDEX IF NOT EXISTS idx_word_progress_next ON word_progress(next_review_at);

-- FSRS 升级：为已有 PG 库补齐 4 个记忆状态列（幂等）。
ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS fsrs_stability DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS fsrs_difficulty DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS fsrs_state INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS fsrs_lapses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wrong_questions ADD COLUMN IF NOT EXISTS fsrs_stability DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE wrong_questions ADD COLUMN IF NOT EXISTS fsrs_difficulty DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE wrong_questions ADD COLUMN IF NOT EXISTS fsrs_state INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wrong_questions ADD COLUMN IF NOT EXISTS fsrs_lapses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE word_progress ADD COLUMN IF NOT EXISTS fsrs_stability DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE word_progress ADD COLUMN IF NOT EXISTS fsrs_difficulty DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE word_progress ADD COLUMN IF NOT EXISTS fsrs_state INTEGER NOT NULL DEFAULT 0;
ALTER TABLE word_progress ADD COLUMN IF NOT EXISTS fsrs_lapses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS prerequisites TEXT;
`;
