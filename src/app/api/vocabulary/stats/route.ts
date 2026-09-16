import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { format, subDays } from "date-fns";
import { db } from "@/db";
import { reviewLogs, wordProgress } from "@/db/schema";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 背单词统计：各状态数量、今日待复习、连续打卡天数
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const rows = await db
    .select()
    .from(wordProgress)
    .where(eq(wordProgress.userId, userId))
    .all();

  const now = Date.now();
  const statusCount = { new: 0, learning: 0, mastered: 0 };
  let due = 0;
  for (const r of rows) {
    statusCount[r.status] = (statusCount[r.status] ?? 0) + 1;
    if (r.nextReviewAt && r.nextReviewAt.getTime() <= now) due++;
  }

  // 连续打卡：从今天起逐日回查 word 复习日志
  const logs = await db
    .select({ reviewedAt: reviewLogs.reviewedAt })
    .from(reviewLogs)
    .where(and(eq(reviewLogs.userId, userId), eq(reviewLogs.targetType, "word")))
    .all();
  const days = new Set(logs.map((l) => format(l.reviewedAt, "yyyy-MM-dd")));

  let streak = 0;
  for (let i = 0; ; i++) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    if (days.has(d)) streak++;
    else break;
  }

  return NextResponse.json({
    total: rows.length,
    ...statusCount,
    due,
    streak,
  });
}
