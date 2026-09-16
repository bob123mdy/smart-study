// 知识点练习：AI 出单选题（自动判对错）；无 AI 时降级为「复述自测」卡片，保证无 AI 也能用。
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chapters, knowledgePoints, subjects } from "@/db/schema";
import { aiConfigured } from "@/lib/ai/provider";
import { generateMcq } from "@/lib/ai/quiz";

export type PracticeQuestion =
  | { type: "mcq"; question: string; options: string[]; answer: number; explanation: string }
  | { type: "recall"; title: string; answer: string; explanation: string };

export interface PracticeResult {
  kpName: string;
  chapter: string | null;
  subject: string | null;
  question: PracticeQuestion;
  source: "ai" | "local";
}

export async function generatePractice(
  userId: string,
  kpId: string,
): Promise<PracticeResult | { error: string }> {
  const kp = await db
    .select({
      name: knowledgePoints.name,
      description: knowledgePoints.description,
      chapter: chapters.name,
      subject: subjects.name,
    })
    .from(knowledgePoints)
    .innerJoin(chapters, eq(knowledgePoints.chapterId, chapters.id))
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(and(eq(knowledgePoints.id, kpId), eq(subjects.userId, userId)))
    .get();
  if (!kp) return { error: "知识点不存在" };

  const base = { kpName: kp.name, chapter: kp.chapter, subject: kp.subject };

  // 1. AI 出题（MCQ）
  if (aiConfigured()) {
    try {
      const { mcq } = await generateMcq({
        name: kp.name,
        description: kp.description,
        chapter: kp.chapter,
        subject: kp.subject,
      });
      return { ...base, question: { type: "mcq", ...mcq }, source: "ai" };
    } catch {
      // AI 失败 → 落到本地兜底，不向用户报错
    }
  }

  // 2. 本地兜底：复述自测（翻答案对照，与复习页的主动回忆一致）
  return {
    ...base,
    question: {
      type: "recall",
      title: kp.name,
      answer: kp.description ?? "（该知识点暂无说明，请凭记忆复述核心概念与要点）",
      explanation: "",
    },
    source: "local",
  };
}
