import { addDays, format } from "date-fns";
import { count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, newId } from "./index";
import {
  chapters,
  goals,
  knowledgePoints,
  milestones,
  sessions,
  subjects,
  tasks,
  teacherPersonas,
  users,
} from "./schema";
import { decomposeGoal } from "../lib/decompose";

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

/** 演示账号（供快速体验 / 验收）：demo@example.com / demo1234 */
export const DEMO_EMAIL = "demo@example.com";
export const DEMO_PASSWORD = "demo1234";

// 1 位预设老师（拥有 5 种能力，可在对话中随时切换）；注册时为新用户各复制一份，互不影响
const PRESET_TEACHERS = [
  {
    name: "林老师",
    type: "explainer",
    subject: "全科",
    systemPrompt: [
      "你是一位全能的私人学习伙伴，拥有多种能力，可在同一段对话中随时切换：",
      "1）讲解：把复杂概念讲透，善用类比、图示与生活例子，先讲直觉再讲严谨定义；",
      "2）出题考核：按知识点出题，由易到难，考察是否真正理解而非记住答案，出题后先让用户作答再讲评；",
      "3）批改：客观评分，给出清晰可复现的评分标准，指出错因并归类（概念不清/计算错误/粗心/审题偏差）；",
      "4）教练规划：规划学习节奏、督促进度，给出可执行可量化的建议，及时鼓励，也可请用户用自己的话复述概念以查漏补缺；",
      "5）苏格拉底诘问：只提问不直接给答案，通过连续追问引导用户独立思考；",
      "6）带学：围绕目标章节自动推进「规划→讲解→考察→查缺补漏」一条龙，全程主导节奏，用户只需自然语言应答。",
      "请根据用户当前需求与聊天室所选的能力，自然地切换并贯彻相应能力。",
    ].join("\n"),
    modelTier: "basic",
  },
] as const;

/** 为新用户初始化：1 位全能老师 + 示例科目（线性代数/英语）+ 示例目标。注册时调用。 */
export async function seedUser(userId: string, name: string): Promise<void> {
  // 1 位全能老师（拥有 5 种能力）
  await db
    .insert(teacherPersonas)
    .values(
      PRESET_TEACHERS.map((t) => ({
        id: newId(),
        userId,
        name: t.name,
        type: t.type,
        subject: t.subject,
        systemPrompt: t.systemPrompt,
        modelTier: t.modelTier,
        isPreset: true,
      })),
    )
    .run();

  // 示例科目：线性代数
  const laId = newId();
  await db
    .insert(subjects)
    .values({
      id: laId,
      userId,
      name: "线性代数",
      description: "大学数学基础课程",
      color: "#6366f1",
      sortOrder: 1,
    })
    .run();

  const laChapters = [
    {
      name: "第1章 行列式",
      kps: ["二阶与三阶行列式", "行列式的性质", "行列式按行（列）展开", "克拉默法则"],
    },
    { name: "第2章 矩阵", kps: ["矩阵的概念与运算", "逆矩阵", "分块矩阵"] },
    {
      name: "第3章 向量组与线性方程组",
      kps: ["向量组的线性相关性", "矩阵的秩", "线性方程组的解"],
    },
    {
      name: "第4章 特征值与特征向量",
      kps: ["特征值与特征向量", "相似矩阵与对角化", "实对称矩阵的对角化"],
    },
  ];

  for (const [ci, ch] of laChapters.entries()) {
    const chapterId = newId();
    await db
      .insert(chapters)
      .values({ id: chapterId, subjectId: laId, name: ch.name, sortOrder: ci + 1 })
      .run();
    for (const kp of ch.kps) {
      await db
        .insert(knowledgePoints)
        .values({ id: newId(), chapterId, name: kp, status: "not_started", mastery: 0, difficulty: 3 })
        .run();
    }
  }

  // 示例科目：英语（轻量）
  const enId = newId();
  await db
    .insert(subjects)
    .values({
      id: enId,
      userId,
      name: "英语",
      description: "词汇与语法",
      color: "#0ea5e9",
      sortOrder: 2,
    })
    .run();

  const enChapters = [
    { name: "词汇", kps: ["高频核心词汇", "词根词缀记忆法"] },
    { name: "语法", kps: ["时态与语态", "从句结构"] },
  ];

  for (const [ci, ch] of enChapters.entries()) {
    const chapterId = newId();
    await db
      .insert(chapters)
      .values({ id: chapterId, subjectId: enId, name: ch.name, sortOrder: ci + 1 })
      .run();
    for (const kp of ch.kps) {
      await db.insert(knowledgePoints).values({ id: newId(), chapterId, name: kp, status: "not_started" }).run();
    }
  }

  // 示例长期目标：3 个月学完线性代数（演示模板拆解）
  const today = new Date();
  const goalId = newId();
  await db
    .insert(goals)
    .values({
      id: goalId,
      userId,
      title: "3个月学完线性代数",
      description: "系统学完线性代数全部章节并掌握核心知识点",
      subjectId: laId,
      startDate: fmt(today),
      targetDate: fmt(addDays(today, 90)),
      status: "active",
      progress: 0,
    })
    .run();

  const { milestones: ms, tasks: ts } = await decomposeGoal(laId, fmt(today), fmt(addDays(today, 90)));

  if (ms.length) {
    await db
      .insert(milestones)
      .values(
        ms.map((m) => ({
          id: m.id,
          goalId,
          title: m.title,
          description: m.description ?? null,
          sortOrder: m.sortOrder,
          targetDate: m.targetDate,
          status: "pending" as const,
        })),
      )
      .run();
  }
  if (ts.length) {
    await db
      .insert(tasks)
      .values(
        ts.map((t) => ({
          id: t.id,
          userId,
          goalId,
          milestoneId: t.milestoneId,
          knowledgePointId: t.knowledgePointId,
          title: t.title,
          type: t.type,
          scheduledDate: t.scheduledDate,
          estimatedMinutes: t.estimatedMinutes,
          status: "todo" as const,
        })),
      )
      .run();
  }

  console.log(`[setup] 已为 ${name}(${userId.slice(0, 8)}…) 初始化：1 老师(5 能力) / 2 科目 / 1 目标`);
}

/** 仅在数据库为空时创建演示账号。 */
export async function seedIfEmpty(): Promise<void> {
  const [row] = await db.select({ c: count() }).from(users).all();
  if (row && row.c > 0) {
    console.log("[setup] 已存在用户，跳过种子初始化");
    return;
  }
  await seed();
}

/** 写入种子（演示账号 + 示例数据）；force=true 时先清空再写入（危险，仅调试用）。 */
export async function seed({ force = false }: { force?: boolean } = {}): Promise<void> {
  if (force) {
    await db.delete(tasks).run();
    await db.delete(milestones).run();
    await db.delete(goals).run();
    await db.delete(knowledgePoints).run();
    await db.delete(chapters).run();
    await db.delete(subjects).run();
    await db.delete(teacherPersonas).run();
    await db.delete(sessions).run();
    await db.delete(users).run();
  }

  const demoId = newId();
  await db
    .insert(users)
    .values({
      id: demoId,
      name: "演示用户",
      email: DEMO_EMAIL,
      passwordHash: bcrypt.hashSync(DEMO_PASSWORD, 10),
      role: "user",
      timezone: "Asia/Shanghai",
    })
    .run();

  await seedUser(demoId, "演示用户");

  console.log(`[setup] 演示账号已创建：${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}
