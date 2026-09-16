// 构建「便携版发布包」：生成 Windows 自包含产物 + 双击启动脚本，发给朋友开箱即用。
// 用法：node scripts/build-portable.mjs
// 关键：构建时用「空 key 的临时 .env」，避免把本机 DEEPSEEK_API_KEY 内联进产物（密钥安全）。
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env");
const envBak = path.join(root, ".env.portable.bak");
const standalone = path.join(root, ".next", "standalone");
const outDir = path.join(root, "dist-portable");
const zipPath = path.join(root, "smart-study-portable.zip");

const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
const cp = (src, dst) => fs.cpSync(src, dst, { recursive: true });
const write = (p, content) => fs.writeFileSync(p, content.replace(/\r?\n/g, "\r\n"), "utf8");

// 以 GBK(936) 编码写 .bat：中文 Windows 的 cmd 用 GBK 解析批处理，
// 若写成 UTF-8，中文标题/echo 会乱码。用 PowerShell -EncodedCommand 传命令，
// 避免命令行中文参数在 execSync 里被再次转码损坏。
const writeGb = (p, content) => {
  const crlf = content.replace(/\r?\n/g, "\r\n");
  const tmp = path.join(path.dirname(p), ".bat.gbk.tmp");
  fs.writeFileSync(tmp, crlf, "utf8");
  const ps = `$t=[IO.File]::ReadAllText('${tmp}',[Text.Encoding]::UTF8);[IO.File]::WriteAllText('${p}',$t,[Text.Encoding]::GetEncoding(936))`;
  const b64 = Buffer.from(ps, "utf16le").toString("base64");
  execSync(`powershell -NoProfile -EncodedCommand ${b64}`, { stdio: "ignore" });
  fs.rmSync(tmp, { force: true });
};

const BAT = `@echo off
setlocal
chcp 65001 >nul
title 智能学习系统

REM 检查 Node.js 是否安装
where node >nul 2>&1
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node.js v24 LTS。
  echo 下载：https://nodejs.org/  国内镜像：https://npmmirror.com/mirrors/node/
  echo 安装时一路点「下一步」即可，装完再双击本脚本。
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

REM 读取可选配置（AI Key 等，见 env.txt）
if exist "%~dp0env.txt" (
  for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%~dp0env.txt") do (
    if not "%%a"=="" if not "%%b"=="" set "%%a=%%b"
  )
)

REM 固定端口，避免与其他程序冲突
set PORT=3210

cd /d "%~dp0"

echo 正在启动服务，首次启动稍慢，请稍候……
start "smart-study-server" /min cmd /c "node server.js"

set /a n=0
:wait
timeout /t 2 /nobreak >nul
netstat -ano | findstr ":3210" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto open
set /a n+=1
if %n% lss 40 goto wait
echo [错误] 启动超时，请把标题为「智能学习系统」的黑窗口里的报错截图反馈。
pause
exit /b 1

:open
start "" "http://localhost:3210"
echo 已启动！浏览器将打开 http://localhost:3210
echo 停止方式：关闭「智能学习系统」黑窗口即可。
timeout /t 3 /nobreak >nul
exit /b 0
`;

const ENV_TXT = `# Smart Study 配置（可选）
# 想用 AI 功能（如「从书名生成计划」），把 DeepSeek API Key 粘贴到下面等号后并保存。
# 没有 key 也能正常使用核心功能（进度/目标/复习/错题本/资料库/导出）。
DEEPSEEK_API_KEY=
`;

const README = `智能学习系统 · 使用说明
========================================

一、准备（只需做一次）
  1. 安装 Node.js v24 LTS（如果电脑还没装）：
     - 官网：https://nodejs.org/  （点绿色 LTS 按钮下载）
     - 国内镜像：https://npmmirror.com/mirrors/node/
     - 安装时一路点「下一步」即可。

二、启动
  1. 双击「启动学习系统.bat」。
  2. 首次启动约 10~30 秒，会自动打开浏览器 http://localhost:3210
  3. 第一次用：点「注册」，填昵称 + 邮箱 + 密码（密码至少 6 位），
     即拥有自己的独立账号。（也可先用演示账号 demo@example.com / demo1234 逛逛）

三、（可选）开启 AI 功能
  - 核心功能不依赖 AI，开箱即用。
  - 想用「从书名生成计划」「老师答疑」等 AI 功能：
    1. 到 https://platform.deepseek.com 注册并充值（费用很低），获取 API Key（sk- 开头）。
    2. 用记事本打开本目录的 env.txt，在 DEEPSEEK_API_KEY= 后面粘贴你的 key，保存。
    3. 重新双击「启动学习系统.bat」。

四、数据与备份
  - 你的所有数据都保存在本目录 data\\smart-study.db，只在你电脑上，不会上传。
  - 备份：复制整个文件夹即可；或在「数据导出」页导出 Markdown / JSON / Anki。

五、停止
  - 关闭「智能学习系统」黑窗口即可停止服务。
`;

console.log("[1/5] 备份并清空 .env 中的密钥（避免内联进产物）…");
let hadEnv = false;
if (fs.existsSync(envPath)) {
  fs.copyFileSync(envPath, envBak);
  hadEnv = true;
}
fs.writeFileSync(envPath, "DATABASE_PATH=./data/smart-study.db\n");

try {
  console.log("[2/5] 构建 production standalone（需 1~2 分钟）…");
  execSync("npm run build", { stdio: "inherit", shell: true });
} finally {
  if (hadEnv) fs.copyFileSync(envBak, envPath);
  fs.rmSync(envBak, { force: true });
}

if (!fs.existsSync(standalone)) throw new Error("未找到 .next/standalone，构建可能失败");

console.log("[3/5] 组装便携目录…");
rm(outDir);
cp(standalone, outDir);
const staticDir = path.join(root, ".next", "static");
if (fs.existsSync(staticDir)) cp(staticDir, path.join(outDir, ".next", "static"));
const publicDir = path.join(root, "public");
if (fs.existsSync(publicDir)) cp(publicDir, path.join(outDir, "public"));
fs.mkdirSync(path.join(outDir, "data"), { recursive: true });

console.log("[4/5] 写启动脚本、配置与说明…");
write(path.join(outDir, "启动学习系统.bat"), BAT);
write(path.join(outDir, "env.txt"), ENV_TXT);
write(path.join(outDir, "使用说明.txt"), README);

console.log("[5/5] 打包 zip…");
rm(zipPath);
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${path.join(outDir, "*")}' -DestinationPath '${zipPath}' -Force"`,
  { stdio: "inherit" },
);

console.log("\n完成！发布包：", zipPath);
console.log("朋友解压后双击「启动学习系统.bat」即可使用。");
