// 复习队列 + 提交评分（纯本地，无 AI 依赖；间隔排期使用 FSRS）

import { and, desc, eq, isNull, lte, ne, or } from "drizzle-orm";
import { db, newId } from "@/db";
import {
  chapters,
  knowledgePoints,
  wrongQuestions,
  reviewLogs,
  subjects,
  type ReviewTargetType,
} from "@/db/schema";
import { scheduleFsrs, type FsrsInput } from "./fsrs";
import { getRetention } from "./settings";

export interface QueueItem {
  type: ReviewTargetType;
  id: string;
  title: string;
  subtitle: string | null;
  stability: number;
  difficulty: number;
  repetitions: number;
  intervalDays: number;
}

// 待复习队列：知识点（非「未开始」且 未复习/已到期）+ 错题（非「已掌握」且 未复习/已到期）
// 到期与状态判断下推到 SQL，避免把用户全部卡片读进内存再在 JS 里过滤。
export async function getReviewQueue(userId: string) {
  const now = new Date();

  const kpRows = await db
    .select({
      id: knowledgePoints.id,
      name: knowledgePoints.name,
      description: knowledgePoints.description,
      stability: knowledgePoints.fsrsStability,
      difficulty: knowledgePoints.fsrsDifficulty,
      repetitions: knowledgePoints.repetitions,
      intervalDays: knowledgePoints.intervalDays,
    })
    .from(knowledgePoints)
    .innerJoin(chapters, eq(knowledgePoints.chapterId, chapters.id))
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(
      and(
        eq(subjects.userId, userId),
        ne(knowledgePoints.status, "not_started"),
        or(isNull(knowledgePoints.nextReviewAt), lte(knowledgePoints.nextReviewAt, now)),
      ),
    )
    .all();

  const kps = kpRows.map(
    (k): QueueItem => ({
      type: "knowledge_point",
      id: k.id,
      title: k.name,
      subtitle: k.description ?? null,
      stability: k.stability,
      difficulty: k.difficulty,
      repetitions: k.repetitions,
      intervalDays: k.intervalDays,
    }),
  );

  const wqs = (
    await db
      .select()
      .from(wrongQuestions)
      .where(
        and(
          eq(wrongQuestions.userId, userId),
          ne(wrongQuestions.status, "mastered"),
          or(isNull(wrongQuestions.nextReviewAt), lte(wrongQuestions.nextReviewAt, now)),
        ),
      )
      .all()
  ).map(
    (w): QueueItem => ({
      type: "wrong_question",
      id: w.id,
      title: w.question,
      subtitle: w.answer ?? null,
      stability: w.fsrsStability,
      difficulty: w.fsrsDifficulty,
      repetitions: w.repetitions,
      intervalDays: w.intervalDays,
    }),
  );

  return { kps, wqs, total: kps.length + wqs.length };
}

export interface ReviewOutcome {
  stability: number;
  difficulty: number;
  repetitions: number;
  intervalDays: number;
  nextReviewAt: Date;
}

// 提交一次复习评分，应用 FSRS 并记录
export async function submitReview(
  userId: string,
  targetType: ReviewTargetType,
  targetId: string,
  quality: number,
): Promise<ReviewOutcome | { error: string }> {
  let prev: FsrsInput;
  let reviewCount = 0;

  if (targetType === "knowledge_point") {
    // 校验知识点归属当前用户（join 到 subject）
    const k = await db
      .select({
        fsrsStability: knowledgePoints.fsrsStability,
        fsrsDifficulty: knowledgePoints.fsrsDifficulty,
        fsrsState: knowledgePoints.fsrsState,
        fsrsLapses: knowledgePoints.fsrsLapses,
        repetitions: knowledgePoints.repetitions,
        intervalDays: knowledgePoints.intervalDays,
        lastReviewedAt: knowledgePoints.lastReviewedAt,
        nextReviewAt: knowledgePoints.nextReviewAt,
      })
      .from(knowledgePoints)
      .innerJoin(chapters, eq(knowledgePoints.chapterId, chapters.id))
      .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
      .where(and(eq(knowledgePoints.id, targetId), eq(subjects.userId, userId)))
      .get();
    if (!k) return { error: "知识点不存在" };
    prev = k;
  } else {
    const w = await db
      .select()
      .from(wrongQuestions)
      .where(and(eq(wrongQuestions.id, targetId), eq(wrongQuestions.userId, userId)))
      .get();
    if (!w) return { error: "错题不存在" };
    prev = {
      fsrsStability: w.fsrsStability,
      fsrsDifficulty: w.fsrsDifficulty,
      fsrsState: w.fsrsState,
      fsrsLapses: w.fsrsLapses,
      repetitions: w.repetitions,
      intervalDays: w.intervalDays,
      lastReviewedAt: w.lastReviewedAt,
      nextReviewAt: w.nextReviewAt,
    };
    reviewCount = w.reviewCount;
  }

  const requestRetention = await getRetention(userId);
  const now = new Date();
  const result = scheduleFsrs(prev, quality, now, requestRetention);

  if (targetType === "knowledge_point") {
    await db
      .update(knowledgePoints)
      .set({
        fsrsStability: result.fsrsStability,
        fsrsDifficulty: result.fsrsDifficulty,
        fsrsState: result.fsrsState,
        fsrsLapses: result.fsrsLapses,
        repetitions: result.repetitions,
        intervalDays: result.intervalDays,
        nextReviewAt: result.nextReviewAt,
        lastReviewedAt: now,
        updatedAt: now,
      })
      .where(eq(knowledgePoints.id, targetId))
      .run();
  } else {
    await db
      .update(wrongQuestions)
      .set({
        fsrsStability: result.fsrsStability,
        fsrsDifficulty: result.fsrsDifficulty,
        fsrsState: result.fsrsState,
        fsrsLapses: result.fsrsLapses,
        repetitions: result.repetitions,
        intervalDays: result.intervalDays,
        nextReviewAt: result.nextReviewAt,
        lastReviewedAt: now,
        reviewCount: reviewCount + 1,
        updatedAt: now,
      })
      .where(eq(wrongQuestions.id, targetId))
      .run();
  }

  await db
    .insert(reviewLogs)
    .values({
      id: newId(),
      userId,
      targetType,
      targetId,
      quality,
      intervalDays: result.intervalDays,
      reviewedAt: now,
    })
    .run();

  return {
    stability: result.fsrsStability,
    difficulty: result.fsrsDifficulty,
    repetitions: result.repetitions,
    intervalDays: result.intervalDays,
    nextReviewAt: result.nextReviewAt,
  };
}

// 复习历史（最近 20 条，附目标名称）
export async function getReviewLogs(userId: string) {
  const logs = await db
    .select()
    .from(reviewLogs)
    .where(eq(reviewLogs.userId, userId))
    .orderBy(desc(reviewLogs.reviewedAt))
    .limit(20)
    .all();

  const kpName = new Map(
    (
      await db
        .select({ id: knowledgePoints.id, name: knowledgePoints.name })
        .from(knowledgePoints)
        .innerJoin(chapters, eq(knowledgePoints.chapterId, chapters.id))
        .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
        .where(eq(subjects.userId, userId))
        .all()
    ).map((k) => [k.id, k.name]),
  );
  const wqTitle = new Map(
    (
      await db
        .select()
        .from(wrongQuestions)
        .where(eq(wrongQuestions.userId, userId))
        .all()
    ).map((w) => [w.id, w.question]),
  );

  return logs.map((l) => ({
    ...l,
    targetName:
      l.targetType === "knowledge_point"
        ? kpName.get(l.targetId) ?? "（已删除）"
        : wqTitle.get(l.targetId) ?? "（已删除）",
  }));
}

// 未来 7 天复习量预测（知识点 + 错题）。只取 nextReviewAt 一列，不拉正文。
export interface ForecastDay {
  date: string;
  label: string;
  due: number;
}

export async function getForecast(userId: string): Promise<{ days: ForecastDay[] }> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const days: ForecastDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() + i);
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`,
      label: i === 0 ? "今天" : i === 1 ? "明天" : `${d.getMonth() + 1}/${d.getDate()}`,
      due: 0,
    };
  });

  const kpDues = await db
    .select({ nextReviewAt: knowledgePoints.nextReviewAt })
    .from(knowledgePoints)
    .innerJoin(chapters, eq(knowledgePoints.chapterId, chapters.id))
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(and(eq(subjects.userId, userId), ne(knowledgePoints.status, "not_started")))
    .all();
  const wqDues = await db
    .select({ nextReviewAt: wrongQuestions.nextReviewAt })
    .from(wrongQuestions)
    .where(and(eq(wrongQuestions.userId, userId), ne(wrongQuestions.status, "mastered")))
    .all();

  const bucket = (nr: Date | null) => {
    // 未复习(null) / 已逾期 / 今天内 → 归入「今天」；更远的按天分桶，超出 7 天忽略
    if (!nr || nr.getTime() < endOfToday.getTime()) {
      days[0].due++;
      return;
    }
    const diff = Math.floor((nr.getTime() - startOfToday.getTime()) / 86400000);
    if (diff >= 0 && diff < 7) days[diff].due++;
  };
  for (const r of kpDues) bucket(r.nextReviewAt);
  for (const r of wqDues) bucket(r.nextReviewAt);

  return { days };
}
