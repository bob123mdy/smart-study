# 个人智能学习系统（Personal Intelligent Learning System）

一个「**无 AI 也能完整使用**」的个人学习管理系统。进度记录、目标拆解、错题复习、长期记忆等核心功能
完全不依赖大模型；AI 只是增强层。所有学习数据本地存储、可导出，密钥走环境变量。

> 当前进度：**P0 + P1 + P2-a + P2-b 全部交付可运行**（核心闭环 · AI 老师 · 长期记忆 · 资料库 RAG · 错题本 · 遗忘曲线复习 · 数据导出 · 多用户认证与数据隔离 · Docker 云端部署 · PostgreSQL/pgvector 双模式）。

---

## 一、已实现功能

| 模块 | 功能 | 页面 |
|---|---|---|
| 学习进度 | 科目 → 章节 → 知识点 三级结构；状态「未开始 / 学习中 / 已掌握」；环形图 + 热力图 | `/`、`/subjects` |
| 目标与计划 | 长期目标 → 里程碑 → 每日任务；一键模板拆解；进度 vs 时间对照显示「超前 / 落后」 | `/goals` |
| 学习记录 | 专注计时 + 手动补录；自动统计连续学习天 / 累计时长 | `/sessions` |
| 老师体系 | 5 种预设老师人格（讲解 / 出题 / 批改 / 学习教练 / 苏格拉底诘问） | `/teachers` |
| AI 对话 | DeepSeek 接入，4 种交互模式（讲解/测验/苏格拉底/费曼检验），SSE 流式输出，共享画像 | `/teachers/[id]` |
| 长期记忆 | 薄弱点 / 易错类型 / 偏好 / 作息，可视化 + 管理（增删改/归档），自动注入 AI 画像 | `/memories` |
| 资料库 RAG | PDF / Word / Markdown / 文本上传 → 切分 → 检索问答，答案标注引用来源，检索不到明确说「资料中未提及」 | `/library` |
| 错题本 | 记录错题（题干/答案/错因），关联科目与知识点，错因分类 + 标签，状态流转（未复习→复习中→已掌握） | `/wrong-questions` |
| 间隔复习 | SM-2 遗忘曲线算法，知识点 + 错题统一排期，评分（重来/困难/一般/简单）决定下次间隔 | `/review` |
| 数据导出 | 一键导出全部学习数据为 Markdown / JSON / Anki 卡片（TSV），数据主权在你手里 | `/export` |
| 多用户认证 | 邮箱 + 密码注册/登录；bcrypt 哈希 + httpOnly session（可撤销）；所有数据按用户完全隔离 | `/login`、`/register` |
| 云端部署 | Docker 多阶段构建（standalone 产物），`docker compose up -d` 一键起服务；双模式数据库（默认 SQLite 零配置，设 `DATABASE_URL` 即切 PostgreSQL/pgvector），数据卷持久化、非 root 运行 | — |

## 二、技术栈

- **前端**：Next.js 14（App Router）+ TypeScript + Tailwind CSS + shadcn/ui 风格组件
- **后端**：Next.js API Routes（`src/app/api/*`），AI 流式用 SSE（ReadableStream）
- **数据库**：双模式门面 —— 默认 SQLite（`better-sqlite3`），设 `DATABASE_URL` 即切 PostgreSQL + pgvector（`node-postgres`）；Drizzle ORM，方言隔离（`schema.sqlite.ts` / `schema.pg.ts` 双写 + `schema.ts` 门面）
- **部署**：Docker 多阶段构建（Next.js `output: standalone`）+ docker-compose 单机编排
- **数据获取**：SWR（乐观更新）
- **LLM**：DeepSeek（OpenAI 兼容协议，`chat/completions` 流式）；通过环境变量支持切换模型
- **向量/RAG**：双模式 —— SQLite 存向量（JSON）+ 内存余弦相似度；PG 存 pgvector（`vector(1024)`，drizzle 自动序列化/反序列化）+ 内存余弦相似度

### 数据库双模式（SQLite 默认 / PostgreSQL 可选）

P0 是单用户本地优先场景，SQLite 零部署、零依赖、数据即一个文件，最契合「`npm run dev` 一键跑起来」。
P2-b 落地为**双模式门面**：`npm run dev` 不设任何变量即走 SQLite（同步）；云端部署设 `DATABASE_URL` 即走 PostgreSQL + pgvector（异步）。

实现要点：

- **方言隔离**：schema 双写（`schema.sqlite.ts` / `schema.pg.ts`），`schema.ts` 门面按 `DATABASE_URL` 运行时选边；业务类型固定为 SQLite 版。
- **统一异步形态**：业务代码统一 `await + .all()/.get()/.run()`；SQLite 侧 `await` 同步值合法，PG 侧由 Proxy 补出 Promise。
- **向量兼容**：`document_chunks.embedding` 在 PG 为 `vector(1024)`（drizzle 自动序列化/反序列化），SQLite 为 JSON 字符串；`retrieve.ts` 用 `toVec` 运行时兼容两者。

## 三、快速启动

### 环境要求

- Node.js ≥ 18.17（本项目在 Node 24 验证通过）
- npm

### 安装（国内网络 + Windows 特别说明）

项目已内置 npm 镜像配置（`.npmrc` 指向 npmmirror），`better-sqlite3` 原生二进制从镜像下载，
无需科学上网、无需本地编译 C++ 工具链。

```bash
npm install
```

> `better-sqlite3` 已固定为 `12.11.1`（该版本提供 Node 24 / ABI 137 的 Windows 预编译包）。

### 配置环境变量

```bash
cp .env.example .env
```

- **不配置任何 Key，进度 / 目标 / 复习 / 长期记忆等核心功能仍完整可用**。
- 只有 **AI 对话** 需要配置 `DEEPSEEK_API_KEY`（在 [DeepSeek 开放平台](https://platform.deepseek.com) 申请）。

```ini
DEEPSEEK_API_KEY=sk-xxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

`EMBEDDING_API_KEY`（硅基流动 BGE）为 P0-c 资料库 RAG 使用，P0-a / P0-b 阶段可留空。

### 启动

```bash
npm run dev
```

- `predev` 会自动建表并（空库时）创建演示账号，然后启动 `next dev`。
- 打开 http://localhost:3000，未登录会自动跳转 `/login`。
- **演示账号**：`demo@example.com` / `demo1234`（已内置 2 科目 / 17 知识点 / 5 老师 / 1 目标）。
- 也可在 `/register` 注册新账号，注册即开箱即用（预设 5 位老师 + 示例科目）。

### 常用脚本

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器（自动建表 + 种子） |
| `npm run build` | 生产构建（类型检查 + 编译） |
| `npm run start` | 生产模式启动 |
| `npm run db:setup` | 只建表 + 空库种子（幂等） |
| `npm run db:seed` | 空库写入种子（幂等，已有数据则跳过） |
| `npm run db:seed -- --force` | **清空**全部数据并重写种子（危险，仅调试） |

### Docker 一键部署（云端）

需要本机安装 Docker（含 compose 插件）。在项目根目录：

```bash
# 可选：先准备 .env 填写 AI 密钥（不填也能用核心功能）
cp .env.example .env

# 默认 SQLite 模式（零配置）
docker compose up -d --build
```

- 首次构建会自动 `npm ci`（走国内镜像）+ `npm run build`（standalone 产物）。
- 启动后访问 http://localhost:3000，首次启动自动创建演示账号 `demo@example.com` / `demo1234`。
- 数据落在命名卷 `study-data`（SQLite 文件持久化，重建容器不丢数据）；容器以非 root 用户运行。
- 查看日志：`docker compose logs -f app`；停止：`docker compose down`（`down -v` 会连同数据卷一起删除，慎用）。

#### 切换 PostgreSQL + pgvector（可选）

```bash
# 1) 在 .env 中设置连接串（指向容器内 db 服务）
echo 'DATABASE_URL=postgres://postgres:postgres@db:5432/smartstudy' >> .env

# 2) 带 pg profile 拉起数据库服务（会自动建表 + 创建 pgvector 扩展）
docker compose --profile pg up -d --build
```

- 应用检测到 `DATABASE_URL` 后自动切换 PG 模式（`initDb` 幂等建表 + `CREATE EXTENSION vector` + 空库种子）。
- PG 数据落在命名卷 `pg-data`，与 SQLite 卷 `study-data` 互相独立。
- 若要本地裸跑 PG（非 Docker），用任意带 pgvector 扩展的 PostgreSQL（≥14），同样只设 `DATABASE_URL` 即可。

## 四、目录结构

```
src/
├── app/
│   ├── page.tsx            # 仪表盘（环形图 + 热力图 + 概览）
│   ├── subjects/           # 科目三级结构管理
│   ├── goals/              # 目标 / 里程碑 / 任务
│   ├── sessions/           # 学习计时与记录
│   ├── teachers/           # 老师列表；teachers/[id] 为 AI 对话页
│   ├── memories/           # 长期记忆管理
│   ├── library/            # 资料库（上传 + 问答 + 引用来源）
│   ├── wrong-questions/    # 错题本
│   ├── review/             # 间隔复习（今日队列 + 复习历史）
│   ├── export/             # 数据导出
│   └── api/                # REST + SSE 路由（chat/conversations/memories/documents/rag/wrong-questions/review/export/…）
├── components/
│   ├── ui/                 # shadcn 风格基础组件
│   ├── dashboard/          # 环形图、热力图
│   ├── chat/               # 对话界面 + 极简 Markdown 渲染
│   ├── memories/           # 记忆管理
│   ├── library/            # 资料库（上传 + 问答 + 引用来源）
│   ├── wrong-questions/    # 错题本
│   ├── review/             # 间隔复习（队列 + 评分 + 历史）
│   ├── export/             # 数据导出
│   └── ...                 # 各模块交互组件
├── db/                     # schema-ddl.ts / schema.ts / index.ts / seed.ts
└── lib/
    ├── ai/                 # provider（DeepSeek）/ prompts（人格+模式）/ profile（画像）
    ├── rag/                # extract（解析 PDF/Word）/ chunk / embed / retrieve（检索）
    ├── sm2.ts              # SM-2 遗忘曲线算法（纯函数）
    ├── review.ts           # 复习队列 + 提交评分
    ├── export.ts           # 数据导出（Markdown / JSON / Anki TSV）
    ├── decompose.ts        # 无 AI 目标拆解
    └── ...
data/smart-study.db         # SQLite 数据文件（运行时生成）
```

## 五、验收自测清单

### P0-a（核心闭环）

- [ ] `npm install` 一次成功；`npm run build` 通过；`npm run dev` 打开无报错
- [ ] 首页显示种子数据（2 科目 / 6 章节 / 17 知识点 / 1 目标）
- [ ] 知识点状态可在「未开始 → 学习中 → 已掌握」间切换；环形图、热力图随之更新
- [ ] 目标可模板拆解为里程碑 + 任务，进度条实时更新，显示「超前 / 落后」
- [ ] 学习计时与手动记录可用，累计时长 / 连续学习天随之更新
- [ ] 全程未配置任何 Key，以上功能均可用（无 AI 也能用）

### P0-b（AI 老师 + 长期记忆）

**长期记忆（无需 Key）**
- [ ] `/memories` 能新增记忆（选类别 + 内容 + 重要度）
- [ ] 记忆按 4 类分组展示，可归档 / 恢复 / 删除
- [ ] 归档的记忆不再出现在分类区，出现在「已归档」并可恢复

**AI 对话（需 `DEEPSEEK_API_KEY`）**
- [ ] 未配置 Key 时，`/teachers/[id]` 发送消息会提示「未配置 DEEPSEEK_API_KEY」，不崩溃
- [ ] 配置 Key 后，5 位老师均能流式回复（逐字显示）
- [ ] 4 种模式（讲解 / 测验 / 苏格拉底 / 费曼检验）行为符合预期
- [ ] 同一老师内新建 / 切换 / 删除历史会话正常
- [ ] 绑定知识点后，老师回答聚焦该知识点
- [ ] 在 `/memories` 添加「薄弱点」，AI 回答能引用该记忆（画像注入生效）
- [ ] 刷新页面后历史对话仍在（会话 + 消息持久化）

### P0-c（资料库 RAG）

**上传与解析（无需 Key）**
- [ ] `/library` 能上传 txt / md / pdf / docx，文档列表出现「就绪」状态
- [ ] 未配置 `EMBEDDING_API_KEY` 时，上传仍成功，状态为「就绪（无向量）」（关键词检索降级）

**检索问答**
- [ ] 提问能命中资料内容时，返回相关原文，并标注「来源」文档与可展开的引用片段
- [ ] 提问与资料无关时，明确返回「资料中未提及」，绝不编造
- [ ] 未配置 `DEEPSEEK_API_KEY` 时，问答返回检索原文（不调用 LLM），功能不中断
- [ ] 配置 `DEEPSEEK_API_KEY` 后，基于引用片段生成回答（引用不丢失）

**管理**
- [ ] 文档可删除；删除后不再参与检索
- [ ] 刷新页面后文档与历史问答仍在（持久化）

### P1-a（错题本）

- [ ] `/wrong-questions` 能新增错题（题干必填，其余可选）
- [ ] 错题可关联科目与知识点；列表展示科目名 / 知识点名
- [ ] 错因分类（概念混淆 / 计算错误 / 粗心大意 / 其他）+ 自定义标签
- [ ] 状态可流转：未复习 → 复习中 → 已掌握
- [ ] 可按错因 / 状态筛选；点击题干展开答案与错因
- [ ] 可删除错题；空题干被拒
- [ ] 全程无需 Key，刷新后错题仍在（持久化）

### P1-b（SM-2 遗忘曲线复习）

- [ ] `/review` 显示「今日待复习」队列（知识点 + 错题分开）
- [ ] 知识点标记为「学习中 / 已掌握」后进入队列；错题录入后自动进入，标记「已掌握」后不再出现
- [ ] 评分四档：重来 / 困难 / 一般 / 简单
- [ ] 首次复习间隔 1 天，第二次 6 天，之后按 EF 递增；评分「重来」归零重学
- [ ] 复习后该项从队列消失，进入「最近复习」历史
- [ ] 错题复习次数（reviewCount）递增
- [ ] 刷新后队列与历史仍在（持久化）；全程无需 Key

### P1-c（数据导出）

- [ ] `/export` 显示三种导出格式（Markdown / JSON / Anki）
- [ ] Markdown 导出含科目 / 知识点 / 目标 / 错题 / 记忆 / 学习记录，格式可读
- [ ] JSON 导出为完整数据快照（含复习日志与 SM-2 状态）
- [ ] Anki 导出为制表符 TSV（含 `#separator:tab` 指令），错题与知识点均生成卡片，含标签
- [ ] 下载文件名正确（smart-study-export.md / .json / smart-study-anki.txt）
- [ ] 无效格式返回 400；全程无需 Key

### P2-a（多用户认证与数据隔离）

- [ ] 未登录访问任意受保护页面自动跳转 `/login`；未登录调用 API 返回 401
- [ ] `/login` 用 `demo@example.com` / `demo1234` 登录成功，进入含种子数据的仪表盘
- [ ] 密码错误返回 401；邮箱重复注册返回 409
- [ ] `/register` 注册新账号即开箱即用（预设 5 老师 + 2 示例科目 + 1 目标）
- [ ] 登出后会话立即失效（原 cookie 无法再访问数据）
- [ ] 两个账号数据完全隔离（科目 / 错题 / 复习 / 记忆 / 导出互不可见）
- [ ] 密码以 bcrypt 哈希存储，数据库无明文；导出/复习/老师/检索均按当前用户过滤

### P2-b-1（Docker 云端部署）

- [ ] `docker compose up -d --build` 构建一次成功（无原生模块 / public 路径报错）
- [ ] 访问 http://localhost:3000，未登录跳 `/login`；`demo@example.com` / `demo1234` 登录成功
- [ ] 首次启动自动创建演示账号（无需手工 seed）
- [ ] 注册新账号即开箱即用；数据写入命名卷
- [ ] `docker compose down` 后再 `up`，学习数据仍在（卷持久化）
- [ ] 容器以非 root 用户运行（`docker compose exec app whoami` → nextjs）

### P2-b-2（PostgreSQL/pgvector 双模式）

- [ ] 默认 `npm run dev`（无 `DATABASE_URL`）走 SQLite，核心功能全部正常（零配置不变）
- [ ] `npm run build` 通过（双模式类型一致，无隐式 any）
- [ ] 设 `DATABASE_URL` 后启动，`initDb` 自动建表 + `CREATE EXTENSION vector` + 空库写入种子
- [ ] PG 模式下注册/登录/科目/错题/复习/导出等读写均正常（业务代码已全量 `await`）
- [ ] PG 模式下上传文档 → 向量写入 `vector(1024)`；RAG 检索按余弦相似度返回
- [ ] `docker compose --profile pg up -d --build` 拉起 db 服务，应用自动切换 PG
- [ ] SQLite → PG 数据迁移：见下方「数据迁移」说明

### SQLite → PostgreSQL 数据迁移

个人数据量级下最简单可靠的迁移是「导出 → 导入」：在 SQLite 环境用 `/export` 导出 JSON，切到 PG 后导入；
或直接全新部署（PG 空库自动种子，历史数据用 Markdown/JSON 导出归档）。
如需真·数据搬迁，可编写一次性脚本遍历 SQLite 各表逐行 `INSERT` 到 PG（两版 schema 字段一一对应，字段名一致）。

---

## 六、路线图

- **P2-a（已完成）**：多用户认证（邮箱 + 密码 bcrypt + httpOnly session）、数据按用户隔离
- **P2-b-1（已完成）**：Docker 云端部署（多阶段构建 + standalone + docker-compose，SQLite 卷持久化）
- **P2-b-2（已完成）**：PostgreSQL/pgvector 双模式（Drizzle 方言隔离 + 连接门面 + 全量异步化 + 向量兼容）
