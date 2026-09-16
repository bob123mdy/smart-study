// 手动执行：npm run db:seed —— 空库则写入种子；加 --force 清空重写
import { seed, seedIfEmpty } from "../src/db/seed";
import { seedBuiltinVocabulary } from "../src/db/vocabulary";

async function main() {
  if (process.argv.includes("--force")) {
    await seed({ force: true });
    console.log("已清空并重写种子数据 ✓");
  } else {
    await seedIfEmpty();
    console.log("种子数据写入完成 ✓（已存在数据则跳过）");
  }
  await seedBuiltinVocabulary();
}
main();
