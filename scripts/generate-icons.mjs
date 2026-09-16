// 从 public/icons/icon.svg 生成各尺寸 PNG（一次性执行：npm run icons）
// 依赖 sharp（devDependency），仅在本地/构建前运行，产物提交到 public/icons/。
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svg = readFileSync(join(root, "public", "icons", "icon.svg"));

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const t of targets) {
  await sharp(svg).resize(t.size, t.size).png().toFile(join(root, "public", "icons", t.name));
  console.log(`✓ ${t.name} (${t.size}x${t.size})`);
}
console.log("图标生成完成");
