// 共享用户画像：把学习进度、薄弱点、长期记忆、最近学习汇总成一段文本，
// 注入到每一位老师的 system prompt，保证 5 位老师「信息一致」。

import { and, asc, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  chapters,
  goals,
  knowledgePoints,
  memories,
  studySessions,
  subjects,
} from "@/db/schema";
import { MEMORY_CATEGORY_LABELS } from "../memories";

/** 构建画像文本（无 AI 也能用 —— 这段文本本身只依赖本地数据库）。 */
export async function buildProfile(userId: string): Promise<string> {
  const lines: string[] = [];

  // 1. 薄弱知识点（掌握度 < 0.6 或正在学习中的）
  const weak = await db
    .select({
      name: knowledgePoints.name,
      mastery: knowledgePoints.mastery,
      status: knowledgePoints.status,
      chapter: chapters.name,
    })
    .from(knowledgePoints)
    .innerJoin(chapters, eq(knowledgePoints.chapterId, chapters.id))
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(and(eq(subjects.userId, userId), lt(knowledgePoints.mastery, 0.6)))
    .orderBy(asc(knowledgePoints.mastery))
    .limit(8)
    .all();

  if (weak.length) {
    lines.push(
      "【薄弱知识点】" +
        weak
          .map(
            (w) =>
              `${w.chapter}·${w.name}（掌握度 ${Math.round(w.mastery * 100)}%${
                w.status === "learning" ? "，正在学" : ""
              }）`,
          )
          .join("、") +
        "。",
    );
  } else {
    lines.push("【薄弱知识点】暂无（尚未标记或尚未开始学习）。");
  }

  // 2. 进行中的目标
  const activeGoals = await db
    .select({ title: goals.title, progress: goals.progress, targetDate: goals.targetDate })
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, "active")))
    .all();
  if (activeGoals.length) {
    lines.push(
      "【进行中的目标】" +
        activeGoals
          .map(
            (g) =>
              `${g.title}（进度 ${Math.round(g.progress * 100)}%${
                g.targetDate ? "，目标日期 " + g.targetDate : ""
              }）`,
          )
          .join("；") +
        "。",
    );
  }

  // 3. 长期记忆（未归档，按重要度排序）
  const mems = await db
    .select()
    .from(memories)
    .where(and(eq(memories.userId, userId), eq(memories.archived, false)))
    .orderBy(desc(memories.importance))
    .limit(20)
    .all();
  if (mems.length) {
    const byCat = new Map<string, string[]>();
    for (const m of mems) {
      const cat = MEMORY_CATEGORY_LABELS[m.category] ?? m.category;
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(m.content);
    }
    lines.push(
      "【长期记忆】" +
        [...byCat.entries()].map(([cat, items]) => `${cat}：${items.join("；")}`).join("。") +
        "。",
    );
  }

  // 4. 最近学习
  const recent = await db
    .select({
      subjectName: subjects.name,
      durationMinutes: studySessions.durationMinutes,
    })
    .from(studySessions)
    .leftJoin(subjects, eq(studySessions.subjectId, subjects.id))
    .where(eq(studySessions.userId, userId))
    .orderBy(desc(studySessions.startedAt))
    .limit(5)
    .all();
  if (recent.length) {
    lines.push(
      "【最近学习】" +
        recent.map((r) => `${r.subjectName ?? "综合"} ${r.durationMinutes} 分钟`).join("、") +
        "。",
    );
  }

  return lines.length ? lines.join("\n") : "暂无画像数据（用户刚开始使用，还没有学习记录）。";
}
