import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { wordbooks, wordProgress, words } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 词库单词列表（附当前用户的背词进度；内置词库共享，自定义词库仅归属者可见）
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const book = await db.select().from(wordbooks).where(eq(wordbooks.id, params.id)).get();
  if (!book) return NextResponse.json({ error: "词库不存在" }, { status: 404 });
  if (book.userId && book.userId !== userId) {
    return NextResponse.json({ error: "无权查看该词库" }, { status: 403 });
  }

  const wordRows = await db
    .select()
    .from(words)
    .where(eq(words.wordbookId, params.id))
    .orderBy(asc(words.sortOrder))
    .all();

  const wordIds = wordRows.map((w) => w.id);
  const progressRows = wordIds.length
    ? await db
        .select()
        .from(wordProgress)
        .where(and(eq(wordProgress.userId, userId), inArray(wordProgress.wordId, wordIds)))
        .all()
    : [];
  const progMap = new Map(progressRows.map((p) => [p.wordId, p]));

  return NextResponse.json(
    wordRows.map((w) => {
      const p = progMap.get(w.id);
      return {
        ...w,
        progress: p
          ? {
              status: p.status,
              ef: p.ef,
              repetitions: p.repetitions,
              intervalDays: p.intervalDays,
              lastReviewedAt: p.lastReviewedAt,
              nextReviewAt: p.nextReviewAt,
              wrongCount: p.wrongCount,
            }
          : null,
      };
    }),
  );
}
