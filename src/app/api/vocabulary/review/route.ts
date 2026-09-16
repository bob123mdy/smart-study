import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, newId } from "@/db";
import { reviewLogs, wordProgress, words, wordbooks, type WordStatus } from "@/db/schema";
import { getUserId } from "@/lib/auth";
import { scheduleFsrs } from "@/lib/fsrs";
import { getRetention } from "@/lib/settings";

export const dynamic = "force-dynamic";

// 背单词评分：应用 FSRS 排期，更新 word_progress，并写入通用复习日志
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const wordId = String(body?.wordId ?? "");
  const quality = Number(body?.quality);
  if (!wordId) return NextResponse.json({ error: "缺少单词 ID" }, { status: 400 });
  if (!Number.isFinite(quality) || quality < 0 || quality > 5) {
    return NextResponse.json({ error: "评分需在 0-5 之间" }, { status: 400 });
  }

  // 校验单词存在，且词库对当前用户可见
  const word = await db
    .select({ id: words.id, wordbookId: words.wordbookId })
    .from(words)
    .where(eq(words.id, wordId))
    .get();
  if (!word) return NextResponse.json({ error: "单词不存在" }, { status: 404 });
  const book = await db.select().from(wordbooks).where(eq(wordbooks.id, word.wordbookId)).get();
  if (book?.userId && book.userId !== userId) {
    return NextResponse.json({ error: "无权操作该单词" }, { status: 403 });
  }

  const existing = await db
    .select()
    .from(wordProgress)
    .where(and(eq(wordProgress.userId, userId), eq(wordProgress.wordId, wordId)))
    .get();

  const prev = {
    fsrsStability: existing?.fsrsStability ?? 0,
    fsrsDifficulty: existing?.fsrsDifficulty ?? 0,
    fsrsState: existing?.fsrsState ?? 0,
    fsrsLapses: existing?.fsrsLapses ?? 0,
    repetitions: existing?.repetitions ?? 0,
    intervalDays: existing?.intervalDays ?? 0,
    lastReviewedAt: existing?.lastReviewedAt ?? null,
    nextReviewAt: existing?.nextReviewAt ?? null,
  };
  const requestRetention = await getRetention(userId);
  const now = new Date();
  const result = scheduleFsrs(prev, quality, now, requestRetention);

  // 状态规则：评分 <3 记错重学；否则进入「学习中」，通过 2 次以上视为「已掌握」
  const status: WordStatus = quality < 3 ? "new" : result.repetitions >= 2 ? "mastered" : "learning";
  const wrongCount = (existing?.wrongCount ?? 0) + (quality < 3 ? 1 : 0);

  const row = {
    userId,
    wordId,
    status,
    fsrsStability: result.fsrsStability,
    fsrsDifficulty: result.fsrsDifficulty,
    fsrsState: result.fsrsState,
    fsrsLapses: result.fsrsLapses,
    repetitions: result.repetitions,
    intervalDays: result.intervalDays,
    lastReviewedAt: now,
    nextReviewAt: result.nextReviewAt,
    wrongCount,
  };

  if (existing) {
    await db
      .update(wordProgress)
      .set({ ...row, updatedAt: now })
      .where(eq(wordProgress.id, existing.id))
      .run();
  } else {
    await db.insert(wordProgress).values({ id: newId(), ...row }).run();
  }

  await db
    .insert(reviewLogs)
    .values({
      id: newId(),
      userId,
      targetType: "word",
      targetId: wordId,
      quality,
      intervalDays: result.intervalDays,
      reviewedAt: now,
    })
    .run();

  return NextResponse.json({ status, ...result, wrongCount });
}
