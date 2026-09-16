// 启动前自动执行：建表（幂等，由 db/index.ts 在导入时完成）+ 空库时写入种子数据 + 写入内置词库
import { seedIfEmpty } from "../src/db/seed";
import { seedBuiltinVocabulary } from "../src/db/vocabulary";

async function main() {
  await seedIfEmpty();
  await seedBuiltinVocabulary();
  console.log("[setup] 数据库就绪 ✓");
}
main();
