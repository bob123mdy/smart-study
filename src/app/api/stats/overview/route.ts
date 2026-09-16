import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { chapters, knowledgePoints, studySessions, subjects } from "@/db/schema";
import { format, subDays } from "date-fns";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const subs = await db
    .select()
    .from(subjects)
    .where(eq(subjects.userId, userId))
    .all();
  const subIds = subs.map((s) => s.id);
  const chs = subIds.length
    ? await db.select().from(chapters).where(inArray(chapters.subjectId, subIds)).all()
    : [];
  const chIds = chs.map((c) => c.id);
  const kps = chIds.length
    ? await db.select().from(knowledgePoints).where(inArray(knowledgePoints.chapterId, chIds)).all()
    : [];
  const sessions = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.userId, userId))
    .all();

  const mastered = kps.filter((k) => k.status === "mastered").length;
  const learning = kps.filter((k) => k.status === "learning").length;
  const notStarted = kps.filter((k) => k.status === "not_started").length;
  const kpTotal = kps.length;
  const completionRate = kpTotal ? Math.round((mastered / kpTotal) * 100) : 0;

  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayMinutes = sessions
    .filter((s) => format(s.startedAt, "yyyy-MM-dd") === todayStr)
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  // 连续学习天数
  const studiedDays = new Set(sessions.map((s) => format(s.startedAt, "yyyy-MM-dd")));
  let cursor = new Date();
  if (!studiedDays.has(format(cursor, "yyyy-MM-dd"))) {
    cursor = subDays(cursor, 1);
  }
  let streakDays = 0;
  while (studiedDays.has(format(cursor, "yyyy-MM-dd"))) {
    streakDays += 1;
    cursor = subDays(cursor, 1);
  }

  return NextResponse.json({
    subjectCount: subs.length,
    chapterCount: chs.length,
    kpTotal,
    mastered,
    learning,
    notStarted,
    completionRate,
    totalMinutes,
    todayMinutes,
    streakDays,
  });
}
