// 把 AI 生成的科目结构（科目 → 章节 → 知识点）落库。
// 纯 DB 写入、无 AI 依赖；供 subjects/generate 与 goals/generate 两个端点复用。

import { eq } from "drizzle-orm";
import { db, newId } from "../db";
import { chapters, knowledgePoints, subjects } from "../db/schema";
import type { CurriculumStructure } from "./ai/curriculum";

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export interface PersistResult {
  subjectId: string;
  chapterCount: number;
  knowledgePointCount: number;
}

export async function persistSubjectStructure(
  userId: string,
  structure: CurriculumStructure,
): Promise<PersistResult> {
  const maxSort = (
    await db
      .select({ m: subjects.sortOrder })
      .from(subjects)
      .where(eq(subjects.userId, userId))
      .all()
  ).reduce((mx, r) => Math.max(mx, r.m), 0);

  const subjectId = newId();
  await db
    .insert(subjects)
    .values({
      id: subjectId,
      userId,
      name: structure.subjectName,
      description: structure.description ?? null,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      sortOrder: maxSort + 1,
    })
    .run();

  let kpCount = 0;
  for (const [ci, ch] of structure.chapters.entries()) {
    const chapterId = newId();
    await db
      .insert(chapters)
      .values({
        id: chapterId,
        subjectId,
        name: ch.name,
        description: ch.description ?? null,
        sortOrder: ci + 1,
      })
      .run();

    if (ch.knowledgePoints.length) {
      await db
        .insert(knowledgePoints)
        .values(
          ch.knowledgePoints.map((name) => ({
            id: newId(),
            chapterId,
            name,
            description: null,
            status: "not_started" as const,
            mastery: 0,
            difficulty: 3,
          })),
        )
        .run();
      kpCount += ch.knowledgePoints.length;
    }
  }

  return { subjectId, chapterCount: structure.chapters.length, knowledgePointCount: kpCount };
}
