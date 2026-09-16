// Next.js 服务端启动钩子：每次启动时（dev / start / Docker standalone）执行。
// 顺序：① 建表（SQLite 幂等 DDL / PG 建表 + vector 扩展）→ ② 空库自动写入演示账号 → ③ 内置词库幂等写入。
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDb } = await import("./src/db");
    await initDb();
    const { seedIfEmpty } = await import("./src/db/seed");
    await seedIfEmpty();
    const { seedBuiltinVocabulary } = await import("./src/db/vocabulary");
    await seedBuiltinVocabulary();
  }
}
