import Database from "better-sqlite3";
import { drizzle as sqliteDrizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import * as sqliteSchema from "./schema.sqlite";
import * as pgSchema from "./schema.pg";
import { SCHEMA_DDL } from "./schema-ddl";
import { PG_SCHEMA_DDL } from "./schema-ddl.pg";

export { schema };

// 是否启用 PostgreSQL（云端）。设置 DATABASE_URL 即切换；否则走本地 SQLite（零配置）。
export const USE_PG = !!process.env.DATABASE_URL;

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "smart-study.db");

function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

// ---- SQLite：轻量迁移（为旧库补齐新增列，幂等，缺列才 ALTER）----
function migrate(sqlite: Database.Database) {
  const ensure = (table: string, cols: [string, string][]) => {
    const existing = new Set(
      sqlite
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((r) => (r as { name: string }).name),
    );
    for (const [name, ddl] of cols) {
      if (!existing.has(name)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
    }
  };
  ensure("knowledge_points", [
    ["ef", "REAL NOT NULL DEFAULT 2.5"],
    ["repetitions", "INTEGER NOT NULL DEFAULT 0"],
    ["interval_days", "INTEGER NOT NULL DEFAULT 0"],
    ["next_review_at", "INTEGER"],
    ["fsrs_stability", "REAL NOT NULL DEFAULT 0"],
    ["fsrs_difficulty", "REAL NOT NULL DEFAULT 0"],
    ["fsrs_state", "INTEGER NOT NULL DEFAULT 0"],
    ["fsrs_lapses", "INTEGER NOT NULL DEFAULT 0"],
    ["prerequisites", "TEXT"],
  ]);
  ensure("users", [["password_hash", "TEXT"]]);

  // FSRS 升级：为旧库的错题表 / 背词进度表补齐 4 个记忆状态列（幂等，缺列才 ALTER）。
  const fsrsCols: [string, string][] = [
    ["fsrs_stability", "REAL NOT NULL DEFAULT 0"],
    ["fsrs_difficulty", "REAL NOT NULL DEFAULT 0"],
    ["fsrs_state", "INTEGER NOT NULL DEFAULT 0"],
    ["fsrs_lapses", "INTEGER NOT NULL DEFAULT 0"],
  ];
  ensure("wrong_questions", fsrsCols);
  ensure("word_progress", fsrsCols);

  // 合并旧版「5 位独立老师」→「1 位老师」：每位用户保留第一条 is_preset 老师，
  // 其余老师的会话重指向保留者后删除（幂等：只处理 is_preset 老师数 > 1 的用户）。
  const hasTable = (name: string) =>
    !!sqlite.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  if (hasTable("teacher_personas") && hasTable("conversations")) {
    const dupUsers = sqlite
      .prepare(
        `SELECT user_id, COUNT(*) AS cnt FROM teacher_personas WHERE is_preset = 1 GROUP BY user_id HAVING cnt > 1`,
      )
      .all() as { user_id: string }[];
    for (const { user_id } of dupUsers) {
      const teachers = sqlite
        .prepare(
          `SELECT id FROM teacher_personas WHERE user_id = ? AND is_preset = 1 ORDER BY created_at ASC, id ASC`,
        )
        .all(user_id) as { id: string }[];
      if (teachers.length <= 1) continue;
      const keepId = teachers[0].id;
      const dupIds = teachers.slice(1).map((t) => t.id);
      const ph = dupIds.map(() => "?").join(",");
      sqlite
        .prepare(`UPDATE conversations SET teacher_persona_id = ? WHERE teacher_persona_id IN (${ph})`)
        .run(keepId, ...dupIds);
      sqlite.prepare(`DELETE FROM teacher_personas WHERE id IN (${ph})`).run(...dupIds);
      console.log(`[migrate] 合并 ${user_id.slice(0, 8)}… 的 ${dupIds.length} 位预设老师 → 1 位`);
    }
  }
}

function openDatabase(): Database.Database {
  const absPath = dbPath === ":memory:" ? dbPath : resolvePath(dbPath);
  if (absPath !== ":memory:") {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
  }
  const sqlite = new Database(absPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  // 幂等建表（每次启动执行一次，CREATE IF NOT EXISTS）
  sqlite.exec(SCHEMA_DDL);
  migrate(sqlite);
  return sqlite;
}

const globalForDb = globalThis as unknown as {
  __smartStudySqlite?: Database.Database;
  __smartStudyPool?: Pool;
};

function getSqlite(): Database.Database {
  if (!globalForDb.__smartStudySqlite) globalForDb.__smartStudySqlite = openDatabase();
  return globalForDb.__smartStudySqlite;
}

function getPool(): Pool {
  if (!globalForDb.__smartStudyPool) {
    globalForDb.__smartStudyPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
  }
  return globalForDb.__smartStudyPool;
}

// ---- PostgreSQL 门面：给 node-postgres 查询构建器补 .all()/.get()/.run() ----
// 业务代码统一「await + .all()/.get()/.run()」形态；SQLite 侧这三个方法原生同步，await 同步值合法。
const K_SELECT = "select";
const K_MUTATE = "mutate";

function wrapBuilder(target: any, kind: string): any {
  const handler: ProxyHandler<any> = {
    get(t, prop, receiver) {
      // 终端方法（补丁）：select 补 .all()/.get()，insert/update/delete 补 .run()
      if (kind === K_SELECT && prop === "all") return t;
      if (kind === K_SELECT && prop === "get") {
        return t.then((r: any) => (r?.length ? r[0] : undefined));
      }
      if (kind === K_MUTATE && prop === "run") {
        return t.then((r: any) => ({ changes: Array.isArray(r) ? r.length : 0 }));
      }
      // then 透传，令构建器可直接 await（容错：即使漏写终端方法也能执行）
      if (prop === "then") return t.then.bind(t);
      // 其余链式方法：调用后继续包装，保持补丁在整条链上生效
      const val = Reflect.get(t, prop, receiver);
      if (typeof val === "function") {
        return (...args: any[]) => wrapBuilder(val.apply(t, args), kind);
      }
      return val;
    },
  };
  return new Proxy(target, handler);
}

function wrapPg(raw: any): any {
  const handler: ProxyHandler<any> = {
    get(t, prop, receiver) {
      if (prop === "select") return (...args: any[]) => wrapBuilder(t.select(...args), K_SELECT);
      if (prop === "insert" || prop === "update" || prop === "delete") {
        return (...args: any[]) => wrapBuilder(t[prop](...args), K_MUTATE);
      }
      const val = Reflect.get(t, prop, receiver);
      return typeof val === "function" ? val.bind(t) : val;
    },
  };
  return new Proxy(raw, handler);
}

// ---- 双模式 db 门面 ----
// 类型固定为 SQLite 方言（.all()/.get()/.run() 同步语义、返回有类型数组），
// 业务层统一「await + .all()/.get()/.run()」书写：SQLite 侧 await 同步值、PG 侧 await Proxy 补出的 Promise，
// 两种模式的「await 结果」类型与运行时一致。运行时按 USE_PG 选择方言实例。
type Db = BetterSQLite3Database<typeof sqliteSchema>;

let _db: Db;
let _pgReady: Promise<void> | null = null;

if (USE_PG) {
  _db = wrapPg(pgDrizzle(getPool(), { schema: pgSchema })) as unknown as Db;
} else {
  _db = sqliteDrizzle(getSqlite(), { schema: sqliteSchema });
}

export const db = _db;

/** PG 模式：建表 + 向量扩展（幂等，服务启动时 await 一次）。SQLite 模式为 no-op。 */
export async function initDb(): Promise<void> {
  if (!USE_PG) return;
  if (!_pgReady) {
    _pgReady = getPool()
      .query(PG_SCHEMA_DDL)
      .then(() => undefined);
  }
  await _pgReady;
}

/** 生成 UUID（Node 18+ 全局可用） */
export function newId(): string {
  return crypto.randomUUID();
}
