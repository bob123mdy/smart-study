// 薄弱点诊断：基于 FSRS 记忆状态找出掌握最不牢的知识点（纯本地，无 AI 依赖）。
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { chapters, knowledgePoints, subjects } from "@/db/schema";

export interface WeakPoint {
  id: string;
  name: string;
  subjectName: string;
  chapterName: string;
  stability: number;
  difficulty: number; // FSRS 难度 0-1（越高越难）
  lapses: number;
  score: number; // 薄弱度（0-3，越大越薄弱）
  reason: string;
}

// 薄弱度打分（三项各 0-1）：
//   1 - stabilityNorm：记忆稳定度越低越弱（stability 为「约 90% 仍记得」的天数，7 天作半衰点归一化）
//   difficulty：FSRS 难度 0-1（越高越难）
//   lapseNorm = min(lapses,5)/5：遗忘/卡壳次数越多越弱
export async function getWeakPoints(userId: string, limit = 3): Promise<WeakPoint[]> {
  const rows = await db
    .select({
      id: knowledgePoints.id,
      name: knowledgePoints.name,
      subjectName: subjects.name,
      chapterName: chapters.name,
      stability: knowledgePoints.fsrsStability,
      difficulty: knowledgePoints.fsrsDifficulty,
      lapses: knowledgePoints.fsrsLapses,
    })
    .from(knowledgePoints)
    .innerJoin(chapters, eq(knowledgePoints.chapterId, chapters.id))
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(and(eq(subjects.userId, userId), ne(knowledgePoints.status, "not_started")))
    .all();

  return rows
    .map((r) => {
      const stabilityNorm = r.stability / (r.stability + 7);
      const lapseNorm = Math.min(r.lapses, 5) / 5;
      const score = 1 - stabilityNorm + r.difficulty + lapseNorm;
      return { ...r, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => {
      const reasons: string[] = [];
      if (r.lapses >= 2) reasons.push(`遗忘 ${r.lapses} 次`);
      if (r.difficulty >= 0.6) reasons.push("难度偏高");
      if (r.stability < 3) reasons.push("记忆不稳");
      if (reasons.length === 0) reasons.push("复习间隔较长");
      return {
        id: r.id,
        name: r.name,
        subjectName: r.subjectName,
        chapterName: r.chapterName,
        stability: r.stability,
        difficulty: r.difficulty,
        lapses: r.lapses,
        score: r.score,
        reason: reasons.join(" · "),
      };
    });
}
